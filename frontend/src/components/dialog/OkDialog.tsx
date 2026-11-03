import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Dialog, { DialogProps } from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { ReactNode } from 'react';

export interface IOkDialogProps {
  /**
   * Optional component to render underneath the dialog text.
   */
  dialogContent?: ReactNode;
  /**
   * The dialog window title text.
   */
  dialogTitle: string;
  /**
   * The dialog window body text.
   */
  dialogText?: string;
  /**
   * Set to `true` to open the dialog, `false` to close the dialog.
   */
  open: boolean;
  /**
   * Callback fired if the dialog is closed.
   */
  onClose: () => void;
  /**
   * `Dialog` props passthrough.
   */
  dialogProps?: Partial<DialogProps>;
}

/**
 * A dialog for displaying a title and content with only a close control.
 *
 * @param {IOkDialogProps} props Dialog content and close behavior.
 * @returns {JSX.Element} The rendered component.
 */
export const OkDialog = (props: IOkDialogProps) => {
  if (!props.open) {
    return <></>;
  }

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      data-testid="ok-dialog"
      aria-labelledby="ok-dialog-title"
      aria-describedby={props.dialogText ? 'ok-dialog-description' : undefined}
      {...props.dialogProps}>
      <DialogTitle
        id="ok-dialog-title"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="h6" component="span">
          {props.dialogTitle}
        </Typography>
        <IconButton aria-label="Close dialog" onClick={props.onClose} size="small">
          <Icon path={mdiClose} size={1} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {props.dialogText ? <DialogContentText id="ok-dialog-description">{props.dialogText}</DialogContentText> : null}
        {props.dialogContent ? <Box>{props.dialogContent}</Box> : null}
      </DialogContent>
    </Dialog>
  );
};
