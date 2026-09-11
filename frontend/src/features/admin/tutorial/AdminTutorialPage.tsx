import { mdiDeleteOutline, mdiPencilOutline, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { debounce } from '@mui/material/utils';
import { DataGrid, GridColDef, GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { MarkdownContent } from 'components/markdown/MarkdownContent';
import {
  AdminMarkdownListItem,
  MarkdownPatchRequest,
  MarkdownWriteRequest,
} from 'hooks/interfaces/useMarkdownApi.interface';
import { useConservationApi } from 'hooks/useConservationApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiPaginationRequestOptions } from 'types/pagination';

const REQUIRED_MARKDOWN_KEYS = ['tutorial'];
const MARKDOWN_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_SORT = 'updatedAt';
const DEFAULT_ORDER = 'desc';

interface MarkdownFormState {
  markdownId: string | null;
  key: string;
  data: string;
  isReserved: boolean;
}

/**
 * Administrative page for managing application Markdown records.
 *
 * @returns {JSX.Element} Markdown administration UI.
 */
export const AdminTutorialPage = () => {
  const conservationApi = useConservationApi();
  const dialogContext = useDialogContext();
  const markdownLoader = useDataLoader(conservationApi.markdown.getAdminMarkdown);
  const markdownRefreshRef = useRef(markdownLoader.refresh);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState<GridSortModel>([{ field: DEFAULT_SORT, sort: DEFAULT_ORDER }]);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [formState, setFormState] = useState<MarkdownFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const paginationOptions = useMemo<ApiPaginationRequestOptions>(() => {
    const sort = sortModel[0];

    return {
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
      sort: sort?.field ?? DEFAULT_SORT,
      order: sort?.sort ?? DEFAULT_ORDER,
      search: searchTerm || undefined,
    };
  }, [paginationModel.page, paginationModel.pageSize, searchTerm, sortModel]);

  markdownRefreshRef.current = markdownLoader.refresh;

  useEffect(() => {
    const loadMarkdown = async () => {
      await markdownRefreshRef.current(paginationOptions);
    };

    void loadMarkdown();
  }, [paginationOptions]);

  const reloadMarkdown = useCallback(async () => {
    await markdownRefreshRef.current(paginationOptions);
  }, [paginationOptions]);

  const debouncedSearch = useMemo(() => {
    return debounce((value: string) => {
      setPaginationModel((current) => ({ ...current, page: 0 }));
      setSearchTerm(value.trim());
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      debouncedSearch.clear();
    };
  }, [debouncedSearch]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    debouncedSearch(value);
  };

  const handleCreate = () => {
    setFormError(null);
    setFormState({
      markdownId: null,
      key: '',
      data: '',
      isReserved: false,
    });
  };

  const handleEdit = useCallback(
    async (row: AdminMarkdownListItem) => {
      try {
        setFormError(null);
        setIsDetailLoading(true);
        const detail = await conservationApi.markdown.getAdminMarkdownById(row.markdown_id);
        setFormState({
          markdownId: detail.markdown_id,
          key: detail.key,
          data: detail.data,
          isReserved: isRequiredMarkdownKey(detail.key),
        });
      } catch (error) {
        console.error('Failed to load Markdown document', error);
        dialogContext.setSnackbar({ open: true, snackbarMessage: 'Failed to load Markdown document.' });
      } finally {
        setIsDetailLoading(false);
      }
    },
    [conservationApi.markdown, dialogContext]
  );

  const handleDelete = useCallback(
    (row: AdminMarkdownListItem) => {
      if (isRequiredMarkdownKey(row.key)) {
        return;
      }

      dialogContext.setYesNoDialog({
        open: true,
        dialogTitle: 'Delete Markdown',
        dialogText: `Delete Markdown record "${row.key}"?`,
        yesButtonLabel: 'Delete',
        noButtonLabel: 'Cancel',
        onNo: () => dialogContext.setYesNoDialog({ open: false }),
        onYes: async () => {
          try {
            setIsDeletingId(row.markdown_id);
            await conservationApi.markdown.deleteAdminMarkdown(row.markdown_id);
            dialogContext.setYesNoDialog({ open: false });
            dialogContext.setSnackbar({ open: true, snackbarMessage: 'Markdown deleted.' });
            await reloadMarkdown();
          } catch (error) {
            console.error('Failed to delete Markdown document', error);
            dialogContext.setSnackbar({ open: true, snackbarMessage: 'Failed to delete Markdown document.' });
          } finally {
            setIsDeletingId(null);
          }
        },
      });
    },
    [conservationApi.markdown, dialogContext, reloadMarkdown]
  );

  const handleSubmit = async () => {
    if (!formState) {
      return;
    }

    const nextKey = formState.key.trim();
    const nextData = formState.data.trim();

    if (!MARKDOWN_KEY_PATTERN.test(nextKey)) {
      setFormError('Key must be a lowercase slug such as tutorial or getting-started.');
      return;
    }

    if (!nextData) {
      setFormError('Markdown is required.');
      return;
    }

    try {
      setIsSaving(true);
      setFormError(null);

      if (formState.markdownId) {
        const payload: MarkdownPatchRequest = formState.isReserved
          ? { data: nextData }
          : { key: nextKey, data: nextData };
        await conservationApi.markdown.updateAdminMarkdown(formState.markdownId, payload);
        dialogContext.setSnackbar({ open: true, snackbarMessage: 'Markdown updated.' });
      } else {
        const payload: MarkdownWriteRequest = { key: nextKey, data: nextData };
        await conservationApi.markdown.createAdminMarkdown(payload);
        dialogContext.setSnackbar({ open: true, snackbarMessage: 'Markdown created.' });
      }

      setFormState(null);
      await reloadMarkdown();
    } catch (error) {
      console.error('Failed to save Markdown document', error);
      setFormError('Failed to save Markdown. Check the key is unique and valid.');
    } finally {
      setIsSaving(false);
    }
  };

  const rows = markdownLoader.data?.markdown ?? [];
  const pagination = markdownLoader.data?.pagination;
  const hasLoadError = Boolean(markdownLoader.error);

  const columns = useMemo<GridColDef<AdminMarkdownListItem>[]>(
    () => [
      {
        field: 'key',
        headerName: 'Key',
        flex: 0.8,
        minWidth: 180,
      },
      {
        field: 'preview',
        headerName: 'Preview',
        flex: 1.6,
        minWidth: 280,
        sortable: false,
      },
      {
        field: DEFAULT_SORT,
        headerName: 'Updated',
        flex: 0.8,
        minWidth: 160,
        valueGetter: (_value, row) => row.updated_at ?? row.created_at ?? '',
      },
      {
        field: 'updated_by',
        headerName: 'Updated By',
        flex: 0.8,
        minWidth: 220,
        sortable: false,
        valueGetter: (_value, row) => row.updated_by ?? row.created_by ?? '',
      },
      {
        field: 'actions',
        headerName: 'Actions',
        sortable: false,
        filterable: false,
        width: 190,
        renderCell: ({ row }) => {
          const isReserved = isRequiredMarkdownKey(row.key);

          return (
            <Stack direction="row" gap={1}>
              <Button
                size="small"
                variant="text"
                startIcon={<Icon path={mdiPencilOutline} size={0.7} />}
                onClick={() => {
                  void handleEdit(row);
                }}>
                Edit
              </Button>
              <Button
                size="small"
                variant="text"
                color="error"
                disabled={isReserved || isDeletingId === row.markdown_id}
                startIcon={<Icon path={mdiDeleteOutline} size={0.7} />}
                onClick={() => {
                  handleDelete(row);
                }}>
                Delete
              </Button>
            </Stack>
          );
        },
      },
    ],
    [handleDelete, handleEdit, isDeletingId]
  );

  return (
    <Box height="100%" overflow="auto" sx={{ backgroundColor: 'background.default' }}>
      <Stack gap={2} sx={{ p: { xs: 2, md: 3 } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ md: 'center' }}
          gap={2}>
          <Typography variant="h2">Tutorial</Typography>
          <Button variant="contained" startIcon={<Icon path={mdiPlus} size={0.8} />} onClick={handleCreate}>
            Create Markdown
          </Button>
        </Stack>

        <TextField
          value={searchInput}
          label="Search"
          size="small"
          onChange={(event) => handleSearchChange(event.target.value)}
          sx={{ maxWidth: 420 }}
        />

        {hasLoadError && <Alert severity="error">Unable to load Markdown records.</Alert>}

        <Box sx={{ height: 560, width: '100%', backgroundColor: 'common.white' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            getRowId={(row) => row.markdown_id}
            loading={markdownLoader.isLoading || isDetailLoading}
            rowCount={pagination?.total ?? 0}
            paginationMode="server"
            sortingMode="server"
            paginationModel={paginationModel}
            onPaginationModelChange={(model) => {
              setPaginationModel(model);
            }}
            sortModel={sortModel}
            onSortModelChange={(model) => {
              setPaginationModel((current) => ({ ...current, page: 0 }));
              setSortModel(model.length ? model : [{ field: DEFAULT_SORT, sort: DEFAULT_ORDER }]);
            }}
            pageSizeOptions={[10, 25, 50]}
            disableRowSelectionOnClick
            slots={{
              noRowsOverlay: () => (
                <Stack height="100%" alignItems="center" justifyContent="center">
                  <Typography color="text.secondary">No Markdown records found.</Typography>
                </Stack>
              ),
              loadingOverlay: () => (
                <Stack height="100%" alignItems="center" justifyContent="center">
                  <CircularProgress aria-label="Loading Markdown records" />
                </Stack>
              ),
            }}
          />
        </Box>
      </Stack>

      <MarkdownDialog
        formState={formState}
        formError={formError}
        isSaving={isSaving}
        onChange={setFormState}
        onClose={() => setFormState(null)}
        onSubmit={handleSubmit}
      />
    </Box>
  );
};

interface MarkdownDialogProps {
  formState: MarkdownFormState | null;
  formError: string | null;
  isSaving: boolean;
  onChange: (formState: MarkdownFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}

/**
 * Raw Markdown create/edit dialog with lightweight preview.
 *
 * @param {MarkdownDialogProps} props Dialog props.
 * @returns {JSX.Element} Markdown editing dialog.
 */
const MarkdownDialog = ({ formState, formError, isSaving, onChange, onClose, onSubmit }: MarkdownDialogProps) => {
  if (!formState) {
    return <></>;
  }

  return (
    <Dialog open fullWidth maxWidth="lg" onClose={onClose}>
      <DialogTitle>{formState.markdownId ? 'Edit Markdown' : 'Create Markdown'}</DialogTitle>
      <DialogContent>
        <Stack gap={2} sx={{ pt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Key"
            size="small"
            value={formState.key}
            disabled={formState.isReserved}
            helperText={
              formState.isReserved ? 'The tutorial key is required by the application and cannot be renamed.' : ''
            }
            onChange={(event) => onChange({ ...formState, key: event.target.value })}
          />
          <TextField
            label="Markdown"
            value={formState.data}
            onChange={(event) => onChange({ ...formState, data: event.target.value })}
            multiline
            minRows={12}
            fullWidth
          />
          <Box>
            <Typography variant="h3" mb={1}>
              Preview
            </Typography>
            <Box sx={{ border: '1px solid', borderColor: 'divider', p: 2, backgroundColor: 'background.default' }}>
              <MarkdownContent markdown={formState.data} />
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button onClick={onSubmit} variant="contained" disabled={isSaving}>
          {isSaving ? 'Saving' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Checks whether a Markdown key is protected by an application route.
 *
 * @param {string} key Markdown key.
 * @returns {boolean} True when the key is application-required.
 */
function isRequiredMarkdownKey(key: string): boolean {
  return REQUIRED_MARKDOWN_KEYS.includes(key);
}
