import { useState, useCallback } from 'react';
import { useUser } from '../context/UserContext';

/**
 * useAuthGate — gates an action behind auth verification.
 *
 * Usage:
 *   const { requireAuth, authSheetProps } = useAuthGate();
 *
 *   // In handler:
 *   requireAuth('vote on this poll', () => { castVote(); });
 *
 *   // In JSX:
 *   <AuthPromptSheet {...authSheetProps} />
 */
export function useAuthGate() {
  const { user } = useUser();
  const [visible, setVisible] = useState(false);
  const [actionLabel, setActionLabel] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requireAuth = useCallback(
    (label: string, action: () => void) => {
      if (user) {
        // Already authenticated — run immediately
        action();
      } else {
        // Show auth sheet, store action for after sign-in
        setActionLabel(label);
        setPendingAction(() => action);
        setVisible(true);
      }
    },
    [user],
  );

  const handleClose = useCallback(() => {
    setVisible(false);
    setPendingAction(null);
  }, []);

  const handleSuccess = useCallback(() => {
    setVisible(false);
    // Run the pending action after auth
    if (pendingAction) {
      // Small delay to let auth state propagate
      setTimeout(() => {
        pendingAction();
        setPendingAction(null);
      }, 500);
    }
  }, [pendingAction]);

  return {
    requireAuth,
    authSheetProps: {
      visible,
      onClose: handleClose,
      onSuccess: handleSuccess,
      actionLabel,
    },
  };
}
