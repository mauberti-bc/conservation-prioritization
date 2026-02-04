import { AuthContext } from 'context/authContext';
import { DialogContext, IDialogContext } from 'context/dialogContext';
import { MapContext } from 'context/mapContext';
import { useContext } from 'react';

/**
 * Returns an instance of `IDialogContext` from `DialogContext`.
 *
 * @return {*}  {IDialogContext}
 */
export const useDialogContext = (): IDialogContext => {
  const context = useContext(DialogContext);

  if (!context) {
    throw Error(
      'DialogContext is undefined, please verify you are calling useDialogContext() as child of an <DialogContextProvider> component.'
    );
  }

  return context;
};

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within a AuthProvider');
  }
  return context;
};
