export const SIDEBAR_FLOAT_MARGIN_PX = 16;
export const SIDEBAR_FLOAT_BORDER_RADIUS = 2;
export const SIDEBAR_FLOAT_WIDTH = {
  xs: '60vw',
  sm: '60vw',
  md: '50vw',
  lg: '40vw',
};
export const SIDEBAR_FLOAT_MIN_WIDTH = 360;
export const SIDEBAR_STATUS_CHIP_LEFT = {
  xs: '50%',
  sm: `calc((100% + ${SIDEBAR_FLOAT_MARGIN_PX}px + max(${SIDEBAR_FLOAT_MIN_WIDTH}px, ${SIDEBAR_FLOAT_WIDTH.sm})) / 2)`,
  md: `calc((100% + ${SIDEBAR_FLOAT_MARGIN_PX}px + max(${SIDEBAR_FLOAT_MIN_WIDTH}px, ${SIDEBAR_FLOAT_WIDTH.md})) / 2)`,
  lg: `calc((100% + ${SIDEBAR_FLOAT_MARGIN_PX}px + max(${SIDEBAR_FLOAT_MIN_WIDTH}px, ${SIDEBAR_FLOAT_WIDTH.lg})) / 2)`,
};
