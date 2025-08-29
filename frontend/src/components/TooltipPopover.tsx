import { Tooltip, TooltipProps } from '@mui/material';
import { isValidElement, PropsWithChildren } from 'react';
import { appTheme } from 'theme/AppTheme';

interface ITooltipPopoverProps {
  tooltip: string;
  placement?: TooltipProps['placement'];
}

/**
 * Wraps any content and shows a tooltip on hover.
 * Accepts strings, fragments, or full elements.
 */
export const TooltipPopover = (props: PropsWithChildren<ITooltipPopoverProps>) => {
  const { tooltip, placement, children } = props;

  // Ensure children is always a valid React element
  const wrappedChildren = isValidElement(children) ? children : <span>{children}</span>;

  return (
    <Tooltip
      title={tooltip}
      arrow
      enterDelay={500}
      placement={placement}
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: appTheme.palette.primary.main,
            color: 'white',
            fontSize: '1rem',
            px: 2,
            py: 2,
            borderRadius: 1,
            boxShadow: 3,
            maxWidth: 500,
          },
        },
        arrow: {
          sx: {
            color: appTheme.palette.primary.main,
          },
        },
      }}>
      {wrappedChildren}
    </Tooltip>
  );
};
