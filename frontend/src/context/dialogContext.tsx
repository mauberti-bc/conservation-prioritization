import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import IconButton from '@mui/material/IconButton';
import Snackbar, { SnackbarProps } from '@mui/material/Snackbar';
import YesNoDialog, { IYesNoDialogProps } from 'components/dialog/YesNoDialog';
import { createContext, ReactNode, useState } from 'react';

export interface IDialogContext {
  /**
   * Set the snackbar props.
   *
   * Note: Any props that are not provided, will default to whatever value was previously set (or the default value)
   *
   * @memberof IDialogContext
   */
  setSnackbar: (props: Partial<ISnackbarProps>) => void;
  /**
   * The current snackbar props.
   *
   * @type {ISnackbarProps}
   * @memberof IDialogContext
   */
  snackbarProps: ISnackbarProps;
  /**
   * Set the yes no dialog props.
   *
   * Note: Any props that are not provided, will default to whatever value was previously set (or the default value)
   *
   * @memberof IDialogContext
   */
  setYesNoDialog: (props: Partial<IYesNoDialogProps>) => void;
  /**
   * The current YesNoDialog props.
   *
   * @type {IYesNoDialogProps}
   * @memberof IDialogContext
   */
  yesNoDialogProps: IYesNoDialogProps;
}

export interface ISnackbarProps {
  open: boolean;
  onClose?: () => void;
  snackbarMessage: ReactNode;
  snackbarAutoCloseMs?: number;
  sx: SnackbarProps['sx'];
}

const defaultSnackbarProps: ISnackbarProps = {
  snackbarMessage: '',
  open: false,
  sx: {},
};

const defaultYesNoDialogProps: IYesNoDialogProps = {
  dialogTitle: '',
  dialogText: '',
  open: false,
  onClose: () => {
    // default do nothing
  },
  onNo: () => {
    // default do nothing
  },
  onYes: () => {
    // default do nothing
  },
};

export const DialogContext = createContext<IDialogContext>({
  setSnackbar: () => {
    // default do nothing
  },
  snackbarProps: defaultSnackbarProps,
  setYesNoDialog: () => {},
  yesNoDialogProps: defaultYesNoDialogProps,
});

/**
 * Wraps the provided children in a context that provides various modal dialogs/popups.
 *
 * @param {*} props
 * @return {*}
 */
export const DialogContextProvider: React.FC<React.PropsWithChildren> = (props) => {
  const [snackbarProps, setSnackbarProps] = useState<ISnackbarProps>(defaultSnackbarProps);
  const [yesNoDialogProps, setYesNoDialogProps] = useState<IYesNoDialogProps>(defaultYesNoDialogProps);

  const setSnackbar = function (partialProps: Partial<ISnackbarProps>) {
    setSnackbarProps({ onClose: () => setSnackbar({ open: false }), ...snackbarProps, ...partialProps });
  };

  const setYesNoDialog = function (partialProps: Partial<IYesNoDialogProps>) {
    setYesNoDialogProps({ onClose: () => setYesNoDialog({ open: false }), ...yesNoDialogProps, ...partialProps });
  };

  return (
    <DialogContext.Provider
      value={{
        setSnackbar,
        snackbarProps,
        yesNoDialogProps,
        setYesNoDialog,
      }}>
      {props.children}

      <Snackbar
        sx={snackbarProps.sx}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        open={snackbarProps.open}
        autoHideDuration={snackbarProps?.snackbarAutoCloseMs ?? 6000}
        onClose={snackbarProps.onClose}
        message={snackbarProps.snackbarMessage}
        action={
          <IconButton size="small" aria-label="close" color="inherit" onClick={snackbarProps.onClose}>
            <Icon path={mdiClose} size={0.85} />
          </IconButton>
        }
      />

      <YesNoDialog {...yesNoDialogProps} open={yesNoDialogProps.open} onClose={yesNoDialogProps.onClose} />
    </DialogContext.Provider>
  );
};
