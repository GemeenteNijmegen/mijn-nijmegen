import { Construct } from 'constructs';
import { PipelineStack, PipelineStackProps } from './PipelineStack';

export class PipelineStackAcceptance extends PipelineStack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

  }
}
