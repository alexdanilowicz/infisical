import crypto from 'crypto';

import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import frameworkIntegrationOptions from 'public/json/frameworkIntegrations.json';

import ActivateBotDialog from '@app/components/basic/dialog/ActivateBotDialog';
import CloudIntegrationSection from '@app/components/integrations/CloudIntegrationSection';
import FrameworkIntegrationSection from '@app/components/integrations/FrameworkIntegrationSection';
import IntegrationSection from '@app/components/integrations/IntegrationSection';
import NavHeader from '@app/components/navigation/NavHeader';
import { getTranslatedServerSideProps } from '@app/components/utilities/withTranslateProps';

import {
  decryptAssymmetric,
  encryptAssymmetric
} from '../../components/utilities/cryptography/crypto';
import getBot from '../api/bot/getBot';
import setBotActiveStatus from '../api/bot/setBotActiveStatus';
import getIntegrationOptions from '../api/integrations/GetIntegrationOptions';
import getWorkspaceAuthorizations from '../api/integrations/getWorkspaceAuthorizations';
import getWorkspaceIntegrations from '../api/integrations/getWorkspaceIntegrations';
import getAWorkspace from '../api/workspace/getAWorkspace';
import getLatestFileKey from '../api/workspace/getLatestFileKey';

export default function Integrations() {
  const [cloudIntegrationOptions, setCloudIntegrationOptions] = useState([]);
  const [integrationAuths, setIntegrationAuths] = useState([]);
  const [environments, setEnvironments] = useState<
    {
      name: string;
      slug: string;
    }[]
  >([]);
  const [integrations, setIntegrations] = useState([]);
  // TODO: These will have its type when migratiing towards react-query
  const [bot, setBot] = useState<any>(null);
  const [isActivateBotDialogOpen, setIsActivateBotDialogOpen] = useState(false);
  // const [isIntegrationAccessTokenDialogOpen, setIntegrationAccessTokenDialogOpen] = useState(true);
  const [selectedIntegrationOption, setSelectedIntegrationOption] = useState(null);

  const router = useRouter();
  const workspaceId = router.query.id as string;

  const { t } = useTranslation();

  useEffect(() => {
    (async () => {
      try {
        const workspace = await getAWorkspace(workspaceId);
        setEnvironments(workspace.environments);

        // get cloud integration options
        setCloudIntegrationOptions(await getIntegrationOptions());

        // get project integration authorizations
        setIntegrationAuths(
          await getWorkspaceAuthorizations({
            workspaceId
          })
        );

        // get project integrations
        setIntegrations(
          await getWorkspaceIntegrations({
            workspaceId
          })
        );

        // get project bot
        setBot(await getBot({ workspaceId }));
      } catch (err) {
        console.log(err);
      }
    })();
  }, []);

  /**
   * Activate bot for project by performing the following steps:
   * 1. Get the (encrypted) project key
   * 2. Decrypt project key with user's private key
   * 3. Encrypt project key with bot's public key
   * 4. Send encrypted project key to backend and set bot status to active
   */
  const handleBotActivate = async () => {
    let botKey;
    try {
      if (bot) {
        // case: there is a bot
        const key = await getLatestFileKey({ workspaceId });
        const PRIVATE_KEY = localStorage.getItem('PRIVATE_KEY');

        if (!PRIVATE_KEY) {
          throw new Error('Private Key missing');
        }

        const WORKSPACE_KEY = decryptAssymmetric({
          ciphertext: key.latestKey.encryptedKey,
          nonce: key.latestKey.nonce,
          publicKey: key.latestKey.sender.publicKey,
          privateKey: PRIVATE_KEY
        });

        const { ciphertext, nonce } = encryptAssymmetric({
          plaintext: WORKSPACE_KEY,
          publicKey: bot.publicKey,
          privateKey: PRIVATE_KEY
        });

        botKey = {
          encryptedKey: ciphertext,
          nonce
        };

        setBot(
          (
            await setBotActiveStatus({
              botId: bot._id,
              isActive: !bot.isActive,
              botKey
            })
          ).bot
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * Start integration for a given integration option [integrationOption]
   * @param {Object} obj
   * @param {Object} obj.integrationOption - an integration option
   * @param {String} obj.name
   * @param {String} obj.type
   * @param {String} obj.docsLink
   * @returns
   */
  const handleIntegrationOption = async ({ integrationOption }: { integrationOption: any }) => {
    try {
      // generate CSRF token for OAuth2 code-token exchange integrations
      const state = crypto.randomBytes(16).toString('hex');
      localStorage.setItem('latestCSRFToken', state);

      switch (integrationOption.name) {
        case 'Heroku':
          window.location.assign(
            `https://id.heroku.com/oauth/authorize?client_id=${integrationOption.clientId}&response_type=code&scope=write-protected&state=${state}`
          );
          break;
        case 'Vercel':
          window.location.assign(
            `https://vercel.com/integrations/${integrationOption.clientSlug}/new?state=${state}`
          );
          break;
        case 'Netlify':
          window.location.assign(
            `https://app.netlify.com/authorize?client_id=${integrationOption.clientId}&response_type=code&state=${state}&redirect_uri=${window.location.origin}/netlify`
          );
          break;
        case 'GitHub':
          window.location.assign(
            `https://github.com/login/oauth/authorize?client_id=${integrationOption.clientId}&response_type=code&scope=repo&redirect_uri=${window.location.origin}/github&state=${state}`
          );
          break;
        default:
          break;
        // case 'Fly.io':
        //   console.log('fly.io');
        //   setIntegrationAccessTokenDialogOpen(true);
        //   break;
      }
    } catch (err) {
      console.log(err);
    }
  };

  /**
   * Open dialog to activate bot if bot is not active.
   * Otherwise, start integration [integrationOption]
   * @param {Object} integrationOption - an integration option
   * @param {String} integrationOption.name
   * @param {String} integrationOption.type
   * @param {String} integrationOption.docsLink
   * @returns
   */
  const integrationOptionPress = (integrationOption: any) => {
    try {
      if (bot.isActive) {
        // case: bot is active -> proceed with integration
        handleIntegrationOption({ integrationOption });
        return;
      }

      // case: bot is not active -> open modal to activate bot
      setIsActivateBotDialogOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-bunker-800 max-h-screen flex flex-col justify-between text-white">
      <Head>
        <title>{t('common:head-title', { title: t('integrations:title') })}</title>
        <link rel="icon" href="/infisical.ico" />
        <meta property="og:image" content="/images/message.png" />
        <meta property="og:title" content="Manage your .env files in seconds" />
        <meta name="og:description" content={t('integrations:description') as string} />
      </Head>
      <div className="w-full pb-2 h-screen max-h-[calc(100vh-10px)] overflow-y-scroll no-scrollbar no-scrollbar::-webkit-scrollbar">
        <NavHeader pageName={t('integrations:title')} isProjectRelated />
        <ActivateBotDialog
          isOpen={isActivateBotDialogOpen}
          closeModal={() => setIsActivateBotDialogOpen(false)}
          selectedIntegrationOption={selectedIntegrationOption}
          handleBotActivate={handleBotActivate}
          handleIntegrationOption={handleIntegrationOption}
        />
        {/* <IntegrationAccessTokenDialog
          isOpen={isIntegrationAccessTokenDialogOpen}
          closeModal={() => setIntegrationAccessTokenDialogOpen(false)}
          selectedIntegrationOption={selectedIntegrationOption}
          handleBotActivate={handleBotActivate}
          handleIntegrationOption={handleIntegrationOption}
        /> */}
        <IntegrationSection integrations={integrations} environments={environments} />
        {cloudIntegrationOptions.length > 0 && bot ? (
          <CloudIntegrationSection
            cloudIntegrationOptions={cloudIntegrationOptions}
            setSelectedIntegrationOption={setSelectedIntegrationOption as any}
            integrationOptionPress={integrationOptionPress as any}
            integrationAuths={integrationAuths}
          />
        ) : (
          <div />
        )}
        <FrameworkIntegrationSection frameworks={frameworkIntegrationOptions as any} />
      </div>
    </div>
  );
}

Integrations.requireAuth = true;

export const getServerSideProps = getTranslatedServerSideProps(['integrations']);
