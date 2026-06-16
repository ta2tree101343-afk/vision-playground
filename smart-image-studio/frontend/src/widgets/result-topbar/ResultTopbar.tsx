import { AppTopbar } from '@shared/ui/AppTopbar';
import { Button } from '@shared/ui/Button';

export function ResultTopbar({
  canDownload,
  onBack,
  onDownload,
}: {
  canDownload: boolean;
  onBack: () => void;
  onDownload: () => void | Promise<void>;
}) {
  return (
    <AppTopbar title="Smart Image Studio" subtitle="/ Result">
      <Button onClick={onBack} className="hover-text-primary">
        戻る
      </Button>
      <Button variant="accent" onClick={onDownload} disabled={!canDownload}>
        加工後画像をダウンロード
      </Button>
    </AppTopbar>
  );
}
