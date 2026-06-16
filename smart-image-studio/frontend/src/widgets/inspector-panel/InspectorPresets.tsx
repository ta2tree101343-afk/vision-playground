import { PRESET_ICONS } from '@shared/ui/studioIcons';
import type { PipelinePreset } from '@entities/pipeline';
import { InspectorSection } from './InspectorSection';

export function InspectorPresets({
  builtInPresets,
  activePresetId,
  onApplyPreset,
}: {
  builtInPresets: PipelinePreset[];
  activePresetId: string | null;
  onApplyPreset: (preset: PipelinePreset) => void;
}) {
  return (
    <InspectorSection title="プリセット" defaultOpen>
      <div className="space-y-1">
        {builtInPresets.map((preset) => {
          const isActive = preset.id === activePresetId;
          const Icon = PRESET_ICONS[preset.id];
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(preset)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-all${!isActive ? ' hover-border-accent' : ''}`}
              style={{
                background: isActive ? 'var(--accent-blue-bg)' : 'var(--bg-input)',
                border: `1px solid ${isActive ? 'var(--accent-blue)' : 'var(--border-default)'}`,
              }}
            >
              <div
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded"
                style={{
                  background: isActive ? 'var(--accent-blue-bg-bold)' : 'var(--node-menu-icon-bg)',
                  color: isActive ? 'var(--accent-blue-bright)' : 'var(--text-muted)',
                }}
              >
                {Icon && <Icon className="h-3 w-3" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span
                    className="text-xs font-semibold leading-tight"
                    style={{
                      color: isActive ? 'var(--accent-blue-bright)' : 'var(--text-primary)',
                    }}
                  >
                    {preset.name}
                  </span>
                  <span
                    className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold${isActive ? '' : ' invisible'}`}
                    style={{ background: 'var(--accent-blue)', color: 'white' }}
                  >
                    ✓
                  </span>
                </div>
                <p className="text-[10px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                  {preset.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </InspectorSection>
  );
}
