import cdk = require('@aws-cdk/core');
import eks = require('@aws-cdk/aws-eks');
import iam = require('@aws-cdk/aws-iam');
import lambda = require('@aws-cdk/aws-lambda');
import s3 = require('@aws-cdk/aws-s3');

import { KubeflowCluster } from '../lib/kubeflow-cluster';

export class KubeflowStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // first define the role
    const clusterAdmin = new iam.Role(this, 'AdminRole', {
      assumedBy: new iam.AccountRootPrincipal()
    });

    // The code that defines your stack goes here
    const cluster = new eks.Cluster(this, 'KubeflowCluster', {
      mastersRole: clusterAdmin,
      defaultCapacity: 6,     
    });

    new KubeflowCluster(this, 'KfCluster', {
      cluster,
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(this, 'KubectlLayer', "arn:aws:lambda:eu-west-1:934676248949:layer:lambda-layer-kubectl:1"),
        lambda.LayerVersion.fromLayerVersionArn(this, 'KfctlLayer', "arn:aws:lambda:eu-west-1:934676248949:layer:KfctlLayer:8"),
      ],
      configUrl: "https://raw.githubusercontent.com/kubeflow/manifests/v0.7-branch/kfdef/kfctl_aws.0.7.0.yaml",
      bucket: "kubeflow-demo-mmcclean-eu-west-1",
      adminRole: clusterAdmin,
    });
  }
}

const app = new cdk.App();
new KubeflowStack(app, 'KubeflowStack');
