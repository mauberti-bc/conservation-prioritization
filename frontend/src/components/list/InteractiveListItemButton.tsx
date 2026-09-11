import { ListItemButton, ListItemButtonProps } from '@mui/material';

/**
 * Shared list item button with consistent hover/background styling.
 *
 * @param {ListItemButtonProps} props Component properties.
 * @returns {React.ReactNode} The rendered component.
 */
export const InteractiveListItemButton = (props: ListItemButtonProps) => {
  const { sx, ...rest } = props;

  return (
    <ListItemButton
      {...rest}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        '&:hover': {
          backgroundColor: 'action.hover',
        },
        ...sx,
      }}
    />
  );
};
