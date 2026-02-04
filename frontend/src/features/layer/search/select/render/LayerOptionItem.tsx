import { Box, Checkbox, Chip, Stack, Typography, alpha } from '@mui/material';
import { TaskLayerOption } from 'features/home/task/create/form/layer/task-layer.interface';
import React from 'react';
import { getRandomHexColor } from 'utils/util';

interface LayerOptionItemProps extends React.HTMLAttributes<HTMLLIElement> {
  showCheckbox: boolean;
  option: TaskLayerOption;
  isChecked: boolean;
  onSelect: (layer: TaskLayerOption) => void;
}

export const LayerOptionItem = ({ showCheckbox, option, isChecked, onSelect, ...otherProps }: LayerOptionItemProps) => {
  return (
    <Box
      component="li"
      {...otherProps}
      onClick={(e) => {
        e.preventDefault();
        onSelect?.(option);
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
      {showCheckbox && (
        <Checkbox
          checked={isChecked}
          onChange={() => onSelect(option)}
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
