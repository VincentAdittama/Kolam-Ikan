import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  count?: number;
}

export function ConfirmDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete blocks?",
  description,
  count,
}: ConfirmDeleteDialogProps) {
  const defaultDescription = count 
    ? `Are you sure you want to delete ${count} selected blocks? This action cannot be undone.`
    : "Are you sure you want to delete this block? This action cannot be undone.";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description || defaultDescription}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => {
            onConfirm();
            onClose();
          }}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
