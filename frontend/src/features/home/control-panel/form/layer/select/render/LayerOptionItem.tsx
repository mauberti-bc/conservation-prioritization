import { Box, Checkbox, Chip, Stack, Typography, alpha } from '@mui/material';
import { LayerOption } from 'features/home/control-panel/form/ControlPanelForm';
import React from 'react';
import { getRandomHexColor } from 'utils/util';

interface LayerOptionItemProps {
  checkbox: boolean;
  option: LayerOption;
  isChecked: boolean;
  handleClick: (layer: LayerOption) => void;
  props: React.HTMLAttributes<HTMLLIElement> & { key: string };
}

export const LayerOptionItem = ({ checkbox, option, isChecked, handleClick, props }: LayerOptionItemProps) => {
  const { key, ...otherProps } = props;

  return (
    <Box
      component="li"
      {...otherProps}
      key={key}
      onClick={(e) => {
        e.preventDefault();
        handleClick?.(option);
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        pl: 2,
        pr: 2,
        py: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: isChecked ? alpha('#1976d2', 0.1) : 'transparent',
        cursor: 'pointer',
        '&:hover': {
          bgcolor: isChecked ? alpha('#1976d2', 0.15) : 'action.hover',
        },
      }}>
      {checkbox && (
        <Checkbox
          checked={isChecked}
          onChange={() => handleClick(option)}
          size="small"
          onClick={(e) => e.stopPropagation()}
          sx={{
            color: 'primary.main',
            '&.Mui-checked': {
              color: 'primary.main',
            },
          }}
        />
      )}

      <Typography noWrap sx={{ ml: 1, flexGrow: 1 }} fontWeight={700}>
        {option.name}
      </Typography>

      <Stack direction="row" spacing={0.5} sx={{ ml: 1 }}>
        {option.group.split('/').map((item) => (
          <Chip
            key={item}
            label={item}
            size="small"
            sx={{
              bgcolor: getRandomHexColor(item),
              color: 'white',
              userSelect: 'none',
            }}
          />
        ))}
      </Stack>
    </Box>
  );
};
