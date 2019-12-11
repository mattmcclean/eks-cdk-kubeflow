#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { KubeflowCdkStackStack } from '../lib/kubeflow-cdk-stack-stack';

const app = new cdk.App();
new KubeflowCdkStackStack(app, 'KubeflowCdkStackStack');
