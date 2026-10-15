import {
  Autocomplete,
  Box,
  Button,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteIcon from '@mui/icons-material/Delete';
import { visuallyHiddenSx } from './visuallyHidden';
import {
  emptyVariantRow,
  MAX_OPTION_NAMES,
  MAX_VARIANTS,
  variantLabel,
  type VariantFormRow,
} from '../../utils/productForm';

interface VariantsEditorProps {
  optionNames: string[];
  variants: VariantFormRow[];
  optionNameSuggestions: string[];
  disabled?: boolean;
  onOptionNamesChange: (optionNames: string[]) => void;
  onVariantsChange: (variants: VariantFormRow[]) => void;
}

type EditableField = 'sku' | 'price' | 'compareAtPrice' | 'available';

export default function VariantsEditor({
  optionNames,
  variants,
  optionNameSuggestions,
  disabled = false,
  onOptionNamesChange,
  onVariantsChange,
}: VariantsEditorProps) {
  const canAddVariant = optionNames.length > 0 ? variants.length < MAX_VARIANTS : variants.length === 0;

  function updateVariant(index: number, changes: Partial<VariantFormRow>) {
    onVariantsChange(variants.map((variant, i) => (i === index ? { ...variant, ...changes } : variant)));
  }

  function updateField(index: number, field: EditableField, value: string) {
    const changes: Partial<VariantFormRow> = {};
    changes[field] = value;
    updateVariant(index, changes);
  }

  function updateOptionValue(index: number, optionIndex: number, value: string) {
    const optionValues = optionNames.map((_, i) => (i === optionIndex ? value : (variants[index].optionValues[i] ?? '')));
    updateVariant(index, { optionValues });
  }

  function moveVariant(index: number, targetIndex: number) {
    const next = variants.slice();
    const [variant] = next.splice(index, 1);
    next.splice(targetIndex, 0, variant);
    onVariantsChange(next);
  }

  function fieldInput(index: number, field: EditableField, label: string, numeric: { step: string } | null) {
    return (
      <TextField
        value={variants[index][field]}
        onChange={(e) => updateField(index, field, e.target.value)}
        type={numeric ? 'number' : 'text'}
        size="small"
        variant="standard"
        fullWidth
        disabled={disabled}
        slotProps={{
          htmlInput: {
            'aria-label': `${label} for ${variantLabel(variants[index], index)}`,
            ...(numeric ? { min: 0, step: numeric.step, inputMode: 'decimal' } : { maxLength: 64 }),
          },
        }}
      />
    );
  }

  return (
    <Stack spacing={2}>
      <Autocomplete
        multiple
        freeSolo
        autoSelect
        options={optionNameSuggestions}
        value={optionNames}
        onChange={(_, value) => onOptionNamesChange(value)}
        disabled={disabled}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Options"
            placeholder={optionNames.length < MAX_OPTION_NAMES ? 'e.g. Size' : undefined}
            helperText={`Up to ${MAX_OPTION_NAMES}, such as Size or Color. Leave empty for a product sold in just one version.`}
          />
        )}
      />

      <TableContainer>
        <Table size="small" aria-label="Variants">
          <TableHead>
            <TableRow>
              {optionNames.map((name) => (
                <TableCell key={name}>{name}</TableCell>
              ))}
              <TableCell>SKU</TableCell>
              <TableCell>Price (₹)</TableCell>
              <TableCell>Compare-at (₹)</TableCell>
              <TableCell>Stock</TableCell>
              <TableCell align="right">
                <Box component="span" sx={visuallyHiddenSx}>
                  Actions
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {variants.map((variant, index) => (
              <TableRow key={variant.key}>
                {optionNames.map((name, optionIndex) => (
                  <TableCell key={name} sx={{ minWidth: 120 }}>
                    <TextField
                      value={variant.optionValues[optionIndex] ?? ''}
                      onChange={(e) => updateOptionValue(index, optionIndex, e.target.value)}
                      placeholder={name}
                      size="small"
                      variant="standard"
                      fullWidth
                      disabled={disabled}
                      slotProps={{ htmlInput: { 'aria-label': `${name} for variant ${index + 1}` } }}
                    />
                  </TableCell>
                ))}
                <TableCell sx={{ minWidth: 110 }}>{fieldInput(index, 'sku', 'SKU', null)}</TableCell>
                <TableCell sx={{ minWidth: 90 }}>{fieldInput(index, 'price', 'Price', { step: '0.01' })}</TableCell>
                <TableCell sx={{ minWidth: 90 }}>{fieldInput(index, 'compareAtPrice', 'Compare-at price', { step: '0.01' })}</TableCell>
                <TableCell sx={{ minWidth: 80 }}>{fieldInput(index, 'available', 'Stock', { step: '1' })}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="Move up">
                    <span>
                      <IconButton
                        size="small"
                        aria-label={`Move ${variantLabel(variant, index)} up`}
                        disabled={disabled || index === 0}
                        onClick={() => moveVariant(index, index - 1)}
                      >
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Move down">
                    <span>
                      <IconButton
                        size="small"
                        aria-label={`Move ${variantLabel(variant, index)} down`}
                        disabled={disabled || index === variants.length - 1}
                        onClick={() => moveVariant(index, index + 1)}
                      >
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Remove variant">
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Remove ${variantLabel(variant, index)}`}
                        disabled={disabled || variants.length === 1}
                        onClick={() => onVariantsChange(variants.filter((_, i) => i !== index))}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          startIcon={<AddIcon />}
          disabled={disabled || !canAddVariant}
          onClick={() =>
            onVariantsChange([...variants, emptyVariantRow(optionNames.length, variants[variants.length - 1])])
          }
        >
          Add variant
        </Button>
        {optionNames.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Add an option (like Size) to sell this product in more than one version.
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}
