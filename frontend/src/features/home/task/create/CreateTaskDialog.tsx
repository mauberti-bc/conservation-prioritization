import { MapContextProvider } from 'context/mapContext';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateTaskDialogContent } from './CreateTaskDialogContent';

interface CreateTaskDialogProps {
  onCloseNavigateTo?: string;
}

export const CreateTaskDialog = ({ onCloseNavigateTo = '/t/' }: CreateTaskDialogProps) => {
  const navigate = useNavigate();
  const submitRef = useRef<(() => void) | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    navigate(onCloseNavigateTo);
  };

  const handleSubmit = () => {
    if (!submitRef.current || isSubmitting) {
      return;
    }
    submitRef.current();
  };

  return (
    <MapContextProvider>
      <CreateTaskDialogContent
        submitRef={submitRef}
        isSubmitting={isSubmitting}
        onSubmittingChange={setIsSubmitting}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    </MapContextProvider>
  );
};
