import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

/**
 * Loading skeleton that mirrors the task view panel layout.
 *
 * @returns {JSX.Element} The rendered component.
 */
export const TaskViewPanelSkeleton = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Box sx={{ px: 3, pt: 3, pb: 2, flex: '0 0 auto' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Skeleton variant="text" width="48%" height={32} sx={{ flex: 1 }} />
          <Skeleton variant="rounded" width={92} height={24} />
          <Skeleton variant="circular" width={34} height={34} />
          <Skeleton variant="circular" width={34} height={34} />
        </Stack>
      </Box>

      <Box sx={{ mx: 3, mb: 2, p: 1.5, borderRadius: 1, bgcolor: 'action.hover', flex: '0 0 auto' }}>
        <Stack spacing={0.75}>
          <Skeleton variant="text" width={150} height={24} />
          <Skeleton variant="text" width="100%" height={22} />
          <Skeleton variant="text" width="100%" height={22} />
          <Skeleton variant="text" width="92%" height={22} />
          <Skeleton variant="text" width="88%" height={22} />
        </Stack>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', px: 3, pt: 1, pb: 3 }}>
        <Stack spacing={3}>
          <Skeleton variant="rounded" width="100%" height={40} />

          <Stack spacing={1}>
            <Skeleton variant="text" width={96} height={24} />
            <Skeleton variant="rounded" width="100%" height={94} />
            <Skeleton variant="rounded" width="100%" height={94} />
          </Stack>

          <Stack spacing={1}>
            <Skeleton variant="text" width={88} height={24} />
            <Skeleton variant="rounded" width="100%" height={112} />
            <Skeleton variant="rounded" width="100%" height={112} />
          </Stack>
        </Stack>
      </Box>

      <Box
        sx={{
          px: 3,
          py: 2,
          boxShadow: '0px -2px 25px 0px rgba(0,0,0,0.05)',
          backgroundColor: 'white',
          flex: '0 0 auto',
        }}>
        <Skeleton variant="rounded" width="100%" height={36} />
      </Box>
    </Box>
  );
};
