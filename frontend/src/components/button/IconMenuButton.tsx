import { mdiDotsVertical } from '@mdi/js';
import Icon from '@mdi/react';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { useState } from 'react';

export interface IconMenuItem {
  label: string;
  icon: string;
  onClick: () => void;
}

interface IconMenuButtonProps {
  items: IconMenuItem[];
}

export const IconMenuButton = ({ items }: IconMenuButtonProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleItemClick = (onClick: () => void) => {
    handleClose();
    onClick();
  };

  return (
    <>
      <IconButton onClick={handleOpen} aria-label="menu options">
        <Icon path={mdiDotsVertical} size={1} />
      </IconButton>

      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        {items.map((item, i) => (
          <MenuItem key={i} onClick={() => handleItemClick(item.onClick)}>
            <ListItemIcon>
              <Icon path={item.icon} size={0.9} />
            </ListItemIcon>
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
