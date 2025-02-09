import guidGenerator from '@app/components/utilities/randomId';

import Integration from './Integration';

interface Props {
  integrations: any;
  environments: Array<{ name: string; slug: string }>;
}

interface IntegrationType {
  _id: string;
  app?: string;
  environment: string;
  integration: string;
  integrationAuth: string;
  isActive: boolean;
  context: string;
}

const ProjectIntegrationSection = ({ integrations, environments = [] }: Props) =>
  integrations.length > 0 ? (
    <div className="mb-12">
      <div className="flex flex-col justify-between items-start mx-4 mb-4 mt-6 text-xl max-w-5xl px-2">
        <h1 className="font-semibold text-3xl">Current Integrations</h1>
        <p className="text-base text-gray-400">
          Manage your integrations of Infisical with third-party services.
        </p>
      </div>
      {integrations.map((integration: IntegrationType) => (
        <Integration key={guidGenerator()} integration={integration} environments={environments} />
      ))}
    </div>
  ) : (
    <div />
  );

export default ProjectIntegrationSection;
