import { mdiDotsVertical } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { Fragment, useState } from 'react';

type IconMenuItemColor = 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

export interface IconMenuItem {
  label: string;
  icon: string;
  color?: IconMenuItemColor;
  dividerBefore?: boolean;
  onClick: () => void;
}

interface IconMenuButtonProps {
  items: IconMenuItem[];
  inlineTrigger?: boolean;
}

export const IconMenuButton = ({ items, inlineTrigger = false }: IconMenuButtonProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleOpenElement = (element: HTMLElement) => {
    setAnchorEl(element);
  };

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handleOpenElement(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleItemClick = (event: React.MouseEvent<HTMLElement>, onClick: () => void) => {
    event.stopPropagation();
    handleClose();
    onClick();
  };

  const renderTrigger = () => {
    if (inlineTrigger) {
      return (
        <Box
          component="span"
          role="button"
          aria-label="menu options"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            handleOpenElement(event.currentTarget);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              handleOpenElement(event.currentTarget);
            }
          }}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            px: 0.5,
            py: 0.25,
            cursor: 'pointer',
          }}>
          <Icon path={mdiDotsVertical} size={1} />
        </Box>
      );
    }

    return (
      <IconButton onClick={handleOpen} aria-label="menu options">
        <Icon path={mdiDotsVertical} size={1} />
      </IconButton>
    );
  };

  return (
    <>
      {renderTrigger()}

      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        {items.map((item, i) => (
          <Fragment key={i}>
            {item.dividerBefore && <Divider />}
            <MenuItem
              sx={{
                color: item.color ? `${item.color}.main` : 'text.primary',
                '& .MuiListItemIcon-root': {
                  color: 'inherit',
                },
                '& .MuiListItemText-primary': {
                  color: 'inherit',
                },
              }}
              onClick={(event) => {
                handleItemClick(event, item.onClick);
              }}>
              <ListItemIcon>
                <Icon path={item.icon} size={0.9} color="currentColor" />
              </ListItemIcon>
              <ListItemText>{item.label}</ListItemText>
            </MenuItem>
          </Fragment>
        ))}
      </Menu>
    </>
  );
};
