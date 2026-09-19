import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  updateCategoryAPI,
  getCategoryByIdAPI,
} from "../../services/category/categoryService";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";
import { PageHeader } from "../ui";
import CategoryForm from "./CategoryForm";
import { useWorkspace } from "../../hooks/useWorkspace";

const UpdateCategory = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  const {
    data: category,
    isLoading,
    isError: isLoadError,
    error: loadError,
  } = useQuery({
    queryKey: ["category", id],
    queryFn: () => getCategoryByIdAPI(id),
    enabled: Boolean(id),
  });

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: updateCategoryAPI,
    mutationKey: ["update-category"],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list-categories"] });
      queryClient.invalidateQueries({ queryKey: ["list-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["category", id] });
    },
  });

  useEffect(() => {
    if (!isSuccess) return undefined;

    const timeout = setTimeout(() => navigate("/categories"), 800);
    return () => clearTimeout(timeout);
  }, [isSuccess, navigate]);

  return (
    <div className="max-w-md mx-auto">
      <PageHeader
        title="Editar categoría"
        subtitle="Al cambiar el nombre, sus movimientos pasan con ella."
      />
      <div className="space-y-4">
        {isLoading && <AlertMessage type="loading" message="Cargando…" />}
        {isLoadError && <AlertMessage type="error" message={getErrorMessage(loadError)} />}
        {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
        {isSuccess && <AlertMessage type="success" message="Categoría guardada." />}
        {category && (
          <CategoryForm
            initialValues={{
              name: category.name,
              type: category.type,
              icon: category.icon || "",
              incomeKind: category.incomeKind || "",
            }}
            onSubmit={(values) => mutate({ ...values, id })}
            submitLabel="Guardar cambios"
            pendingLabel="Guardando…"
            isPending={isPending}
          withIncomeKind={workspace?.kind === "iglesia"}
            disabled={isSuccess}
          />
        )}
      </div>
    </div>
  );
};

export default UpdateCategory;
