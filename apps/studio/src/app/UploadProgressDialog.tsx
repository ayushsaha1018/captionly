import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

export function UploadProgressDialog({ progress }: { progress: number | null }) {
  return (
    <Dialog open={progress !== null}>
      <DialogContent
        hideCloseButton
        // Blocking by design: the video isn't attached to the project until this
        // finishes, so letting the user dismiss it (and go transcribe/export early)
        // would leave them acting on a project with no video yet.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-sm"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-edit" />
            Uploading video
          </DialogTitle>
          <DialogDescription>This only takes a moment.</DialogDescription>
        </DialogHeader>
        <Progress value={(progress ?? 0) * 100} className="h-1.5" />
        <p className="text-right text-xs tabular text-ink-muted">
          {Math.round((progress ?? 0) * 100)}%
        </p>
      </DialogContent>
    </Dialog>
  );
}
