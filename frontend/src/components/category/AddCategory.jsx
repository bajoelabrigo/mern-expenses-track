import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { addCategoryAPI } from "../../services/category/categoryService";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";
import { PageHeader } from "../ui";
import CategoryForm from "./CategoryForm";
import { useWorkspace } from "../../hooks/useWorkspace";

const AddCategory = () => {
  const navigate = useNavigate();
  //! Desde "Registrar" llega el tipo que se estaba usando y a dónde volver
  const { state } = useLocation();
  const returnTo = state?.returnTo || "/categories";
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: addCategoryAPI,
    mutationKey: ["add-category"],
    onSuccess: () => {
      //! Refresca cualquier listado de categorías en caché
      queryClient.invalidateQueries({ queryKey: ["list-categories"] });
    },
  });

  //! La redirección va en un efecto, no en el cuerpo del render
  useEffect(() => {
    if (!isSuccess) return undefined;

    const timeout = setTimeout(() => navigate(returnTo), 800);
    return () => clearTimeout(timeout);
  }, [isSuccess, navigate, returnTo]);

  return (
    <div className="max-w-md mx-auto">
      <PageHeader title="Nueva categoría" subtitle="Agrupa los movimientos para ver en qué entra y sale el dinero." />
      <div className="space-y-4">
        {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
        {isSuccess && <AlertMessage type="success" message="Categoría creada." />}
        <CategoryForm
          initialValues={state?.type ? { type: state.type } : undefined}
          onSubmit={(values) => mutate(values)}
          submitLabel="Crear categoría"
          pendingLabel="Creando…"
          isPending={isPending}
          withIncomeKind={workspace?.kind === "iglesia"}
          disabled={isSuccess}
        />
      </div>
    </div>
  );
};

export default AddCategory;
