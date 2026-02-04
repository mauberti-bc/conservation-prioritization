import { LoadingButton } from '@mui/lab';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { Breakpoint } from '@mui/material/styles';
import { Formik, FormikValues } from 'formik';
import { PropsWithChildren, ReactNode } from 'react';

interface IEditDialogComponentProps<T> {
  element: ReactNode;
  initialValues: T;
  validationSchema: any;
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
}

interface IEditDialogProps<T> {
  dialogTitle: string | ReactNode;
  dialogText?: string;
  dialogSaveButtonLabel?: string;
  open: boolean;
  component: IEditDialogComponentProps<T>;
  dialogError?: string;
  dialogLoading?: boolean;
  onCancel: () => void;
  onSave: (values: T) => void;
  debug?: true;
  size?: Breakpoint;
}

export const EditDialog = <T extends FormikValues>({
  open,
  dialogTitle,
  dialogText,
  dialogSaveButtonLabel,
  component,
  dialogError,
  dialogLoading,
  onCancel,
  onSave,
  size = 'xl',
}: PropsWithChildren<IEditDialogProps<T>>) => {
  if (!open) {
    return null;
  }

  return (
    <Formik
      initialValues={component.initialValues}
      validationSchema={component.validationSchema}
      validateOnBlur={component.validateOnBlur ?? true}
      validateOnChange={component.validateOnChange ?? false}
      onSubmit={onSave}>
      {(formikProps) => (
        <Dialog
          data-testid="edit-dialog"
          fullWidth
          maxWidth={size}
          open={open}
          aria-labelledby="edit-dialog-title"
          aria-describedby="edit-dialog-description">
          <DialogTitle id="edit-dialog-title">{dialogTitle}</DialogTitle>

          <DialogContent>
            {dialogText && <DialogContentText sx={{ mb: 1 }}>{dialogText}</DialogContentText>}
            {component.element}
          </DialogContent>

          <DialogActions>
            <LoadingButton
              loading={dialogLoading || formikProps.isValidating}
              disabled={formikProps.status?.forceDisable}
              onClick={formikProps.submitForm}
              color="primary"
              variant="contained"
              autoFocus
              data-testid="edit-dialog-save">
              {dialogSaveButtonLabel || 'Save Changes'}
            </LoadingButton>

            <Button onClick={onCancel} color="primary" variant="outlined" data-testid="edit-dialog-cancel">
              Cancel
            </Button>
          </DialogActions>

          {dialogError && <DialogContent>{dialogError}</DialogContent>}
        </Dialog>
      )}
    </Formik>
  );
};
