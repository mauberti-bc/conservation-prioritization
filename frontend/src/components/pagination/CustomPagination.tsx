import MenuItem from '@mui/material/MenuItem';
import MuiPagination from '@mui/material/Pagination';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

interface CustomPaginationProps {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  lastPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

/**
 * Server-side pagination footer with range summary and page-size selection.
 *
 * @param {CustomPaginationProps} props Pagination state and change handlers.
 * @returns {JSX.Element}
 */
export const CustomPagination = ({
  currentPage,
  pageSize,
  totalCount,
  lastPage,
  onPageChange,
  onPageSizeChange,
}: CustomPaginationProps) => {
  const firstItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalCount);

  const handlePageSizeChange = (event: SelectChangeEvent<number>) => {
    onPageSizeChange(Number(event.target.value));
  };

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="nowrap" gap={1}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="body2" color="text.secondary" noWrap>
          {firstItem}-{lastItem} of {totalCount}
        </Typography>
        <Select<number>
          size="small"
          value={pageSize}
          onChange={handlePageSizeChange}
          inputProps={{ 'aria-label': 'rows per page' }}
          sx={{ fontSize: '0.875rem' }}>
          {PAGE_SIZE_OPTIONS.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      <MuiPagination
        count={Math.max(lastPage, 1)}
        page={currentPage}
        onChange={(_event, page) => {
          onPageChange(page);
        }}
        shape="rounded"
        siblingCount={0}
        boundaryCount={0}
      />
    </Stack>
  );
};
