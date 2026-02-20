import { Box, Card, CardActionArea, Tooltip, Typography, useTheme } from '@mui/material';
import { IconMenuButton, IconMenuItem } from 'components/button/IconMenuButton';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import { MapContainer } from '../map/MapContainer';

interface TaskGridCardProps {
  task: GetTaskResponse;
  onClick: (task: GetTaskResponse) => void;
  menuItems: IconMenuItem[];
}

/**
 * Card tile for a task in the landing page grid.
 *
 * Shows title and description on hover for desktop, and visible title content on mobile.
 */
export const TaskGridCard = ({ task, onClick, menuItems }: TaskGridCardProps) => {
  const theme = useTheme();
  const hasTileset = Boolean(task.tileset_uri);

  return (
    <Card
      elevation={0}
      sx={{
        height: 320,
        borderRadius: 2,
        border: `2px solid ${theme.palette.divider}`,
        overflow: 'hidden',
      }}>
      <CardActionArea
        sx={{ height: '100%' }}
        onClick={() => {
          onClick(task);
        }}>
        <Box
          sx={{
            position: 'relative',
            height: '100%',
          }}>
          <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
            <MapContainer
              pmtilesUrls={task.tileset_uri ? [task.tileset_uri] : []}
              useSharedContext={false}
              interactive={false}
              showNavigationControl={false}
              showBaseLayer={!hasTileset}
              pmtilesOpacity={1}
            />
          </Box>
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 2,
              p: 1.5,
              py: 2,
              minHeight: 92,
              bgcolor: theme.palette.common.white,
              color: theme.palette.text.primary,
            }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
              <Box display="flex" alignItems="center" gap={0.75} minWidth={0} flex={1}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    flex: 1,
                  }}>
                  {task.name}
                </Typography>
                {task.projects?.length ? (
                  <Box display="flex" alignItems="center" gap={0.5} flexShrink={0}>
                    {task.projects.map((project) => (
                      <Tooltip key={project.project_id} title={project.name} arrow>
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: project.colour,
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        />
                      </Tooltip>
                    ))}
                  </Box>
                ) : null}
              </Box>
              <Box
                sx={{ flexShrink: 0 }}
                onClick={(event) => {
                  event.stopPropagation();
                }}>
                <IconMenuButton items={menuItems} />
              </Box>
            </Box>
            <Typography
              variant="body2"
              sx={{
                mt: 0.25,
                minHeight: '1.25em',
                color: theme.palette.text.secondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
              {task.description ?? ''}
            </Typography>
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
};
