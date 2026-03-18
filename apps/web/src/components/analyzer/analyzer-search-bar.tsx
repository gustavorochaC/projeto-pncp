"use client";

import { useCallback, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import { apiClient } from "@/lib/api-client";
import type { NoticeListItem } from "@pncp/types";

interface Props {
  onSelect: (notice: NoticeListItem) => void;
}

export function AnalyzerSearchBar({ onSelect }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [options, setOptions] = useState<NoticeListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setOptions([]);
      return;
    }
    setLoading(true);
    try {
      const result = await apiClient.getNotices({ query, pageSize: 10 });
      setOptions(result.items);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (_: React.SyntheticEvent, value: string) => {
      setInputValue(value);
      const timer = setTimeout(() => void search(value), 300);
      return () => clearTimeout(timer);
    },
    [search],
  );

  return (
    <Autocomplete<NoticeListItem>
      fullWidth
      options={options}
      loading={loading}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      getOptionLabel={(option) => option.object}
      filterOptions={(x) => x}
      noOptionsText="Nenhuma licitação encontrada"
      onChange={(_, value) => {
        if (value) onSelect(value);
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Buscar licitação..."
          placeholder="Digite o objeto da licitação..."
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>{option.object}</div>
            <div style={{ fontSize: "0.75rem", color: "gray" }}>
              {option.agency} — {option.modality} — {option.status}
            </div>
          </div>
        </li>
      )}
    />
  );
}
