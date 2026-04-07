import { useState } from 'react';
import type { PipelineInterpreterMode, PipelinePlan } from '../types/api';
import type { PlannerHistoryEntry } from '../types/image';
import { interpretPipeline } from '../api/pipelineApi';
import { createId } from '../utils/pipeline';

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return fallback;
}

export function usePlanner() {
  const [instruction, setInstruction] = useState('');
  const [mode, setMode] = useState<PipelineInterpreterMode>('rule_based');
  const [plan, setPlan] = useState<PipelinePlan | null>(null);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [history, setHistory] = useState<PlannerHistoryEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function generatePlan() {
    if (instruction.trim() === '') {
      setErrorMessage('自然言語の指示を入力してください。');
      return;
    }

    setIsInterpreting(true);

    try {
      const response = await interpretPipeline({ instruction: instruction.trim(), mode });

      setPlan(response.plan);
      setHistory((current) =>
        [
          {
            id: createId('plan'),
            createdAt: new Date().toISOString(),
            mode: response.plan.interpreter,
            instruction: instruction.trim(),
            plan: response.plan,
          },
          ...current,
        ].slice(0, 6),
      );
      setErrorMessage(response.plan.steps.length === 0 ? '解釈結果に実行可能な step がありません。' : null);
    } catch (error) {
      setPlan(null);
      setErrorMessage(toErrorMessage(error, '自然文の解釈に失敗しました。'));
    } finally {
      setIsInterpreting(false);
    }
  }

  function selectHistory(entryId: string) {
    const entry = history.find((e) => e.id === entryId);
    if (!entry) return;
    setInstruction(entry.instruction);
    setMode(entry.mode);
    setPlan(entry.plan);
  }

  function selectExample(value: string) {
    setInstruction(value);
    setPlan(null);
  }

  return {
    instruction,
    setInstruction,
    mode,
    setMode,
    plan,
    isInterpreting,
    history,
    errorMessage,
    generatePlan,
    selectHistory,
    selectExample,
  };
}
