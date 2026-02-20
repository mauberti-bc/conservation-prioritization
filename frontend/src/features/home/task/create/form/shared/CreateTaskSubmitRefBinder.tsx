import { useFormikContext } from 'formik';
import { MutableRefObject, useEffect } from 'react';
import { TaskCreateFormValues } from '../TaskCreateForm';

interface CreateTaskSubmitRefBinderProps {
  submitRef?: MutableRefObject<(() => void) | null>;
  onSubmittingChange?: (isSubmitting: boolean) => void;
  isSubmitting: boolean;
}

export const CreateTaskSubmitRefBinder = ({
  submitRef,
  onSubmittingChange,
  isSubmitting,
}: CreateTaskSubmitRefBinderProps) => {
  const { submitForm } = useFormikContext<TaskCreateFormValues>();

  useEffect(() => {
    if (!submitRef) {
      return;
    }
    submitRef.current = submitForm;
  }, [submitForm, submitRef]);

  useEffect(() => {
    if (!onSubmittingChange) {
      return;
    }
    onSubmittingChange(isSubmitting);
  }, [isSubmitting, onSubmittingChange]);

  return null;
};
