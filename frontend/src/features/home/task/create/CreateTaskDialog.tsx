import { MapContextProvider } from 'context/mapContext';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateTaskDialogContent } from './CreateTaskDialogContent';

export const CreateTaskDialog = () => {
  const navigate = useNavigate();
  const submitRef = useRef<(() => void) | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    navigate('/t/');
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
