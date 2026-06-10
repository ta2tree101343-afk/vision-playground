import type { OperationType } from '@shared/types/api';
import type { ParameterKey } from '@entities/pipeline/model/pipeline.types';

export interface ParameterDefinition {
  key: ParameterKey;
  label: string;
  min: number;
  max: number;
  step: number;
  helpText: string;
}

export interface OperationOption {
  value: OperationType;
  label: string;
  labelJa: string;
  isAiOp: boolean;
  description: string;
  icon: string;
  parameters: ParameterDefinition[];
}
