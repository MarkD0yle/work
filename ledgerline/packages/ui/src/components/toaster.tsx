import { Toaster as Sonner, toast as sonnerToast } from 'sonner';

/**
 * Toasts are for lightweight confirmation only: "Saved", "Copied" (SPEC 7.7, 5 seconds).
 * Anything the user must not miss (errors, warnings, partial results) goes to a banner, a field message
 * and the notification panel instead. Critical information is never a toast.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      duration={5000}
      visibleToasts={3}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex items-center gap-2 rounded-md border bg-popover px-3 py-2 text-body text-popover-foreground shadow-popover',
          title: 'font-medium',
          description: 'text-muted-foreground',
        },
      }}
    />
  );
}

/** Shows a short confirmation. It is also announced politely to screen readers. */
export function toast(message: string, description?: string): void {
  sonnerToast(message, description ? { description } : undefined);
}
