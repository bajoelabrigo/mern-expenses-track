import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LuChevronRight, LuPlus, LuTrash2 } from "react-icons/lu";
import {
  deleteCategoryAPI,
  listCategoriesAPI,
} from "../../services/category/categoryService";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";
import { useWorkspace } from "../../hooks/useWorkspace";
import { ButtonLink, CategoryIcon, EmptyState, ListGroup, PageHeader } from "../ui";
import { capitalize } from "../ui/styles";

const GROUPS = [
  { type: "income", title: "Ingresos" },
  { type: "expense", title: "Gastos" },
];

const CategoriesList = () => {
  const queryClient = useQueryClient();
  const { can } = useWorkspace();
  const canWrite = can("category:write");

  const {
    data: categories = [],
    isError,
    isLoading,
    error,
  } = useQuery({
    queryFn: listCategoriesAPI,
    queryKey: ["list-categories"],
  });

  const {
    mutateAsync,
    isError: isDeleteError,
    error: deleteError,
  } = useMutation({
    mutationFn: deleteCategoryAPI,
    mutationKey: ["delete-category"],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list-categories"] });
      queryClient.invalidateQueries({ queryKey: ["list-transactions"] });
    },
  });

  const handleDelete = async (id, nombre) => {
    //! Borrar una categoría reasigna sus transacciones: conviene confirmar
    const confirmado = window.confirm(
      `¿Eliminar la categoría "${nombre}"? Sus movimientos pasarán a "uncategorized".`
    );
    if (!confirmado) return;

    try {
      await mutateAsync(id);
    } catch {
      // el mensaje se muestra con AlertMessage
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Categorías"
        subtitle="Cómo se agrupan los movimientos de este espacio."
        action={
          canWrite && (
            <ButtonLink to="/add-category" size="sm">
              <LuPlus aria-hidden="true" /> Nueva
            </ButtonLink>
          )
        }
      />

      <div className="space-y-6">
        {isLoading && <AlertMessage type="loading" message="Cargando…" />}
        {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
        {isDeleteError && <AlertMessage type="error" message={getErrorMessage(deleteError)} />}

        {!isLoading && !isError && categories.length === 0 && (
          <EmptyState
            title="Todavía no hay categorías"
            action={canWrite && <ButtonLink to="/add-category">Crear la primera</ButtonLink>}
          >
            Por ejemplo: diezmos, ofrendas, luz, alquiler.
          </EmptyState>
        )}

        {GROUPS.map(({ type, title }) => {
          const items = categories.filter((c) => c.type === type);
          if (items.length === 0) return null;
          return (
            <section key={type} aria-label={title}>
              <h2 className="text-sm font-bold text-muted px-1 mb-2">
                {title} <span className="font-semibold">· {items.length}</span>
              </h2>
              <ListGroup>
                {items.map((category) => (
                  <div key={category._id} className="flex items-center gap-3 pl-4 pr-2 py-3">
                    <CategoryIcon name={category.name} icon={category.icon} />
                    {canWrite ? (
                      <Link
                        to={`/update-category/${category._id}`}
                        className="flex-1 min-w-0 flex items-center gap-2 font-semibold text-ink"
                        aria-label={`Editar ${category.name}`}
                      >
                        <span className="truncate">{capitalize(category.name)}</span>
                        <LuChevronRight aria-hidden="true" className="ml-auto text-muted shrink-0" />
                      </Link>
                    ) : (
                      <span className="flex-1 min-w-0 truncate font-semibold text-ink">
                        {capitalize(category.name)}
                      </span>
                    )}
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => handleDelete(category._id, category.name)}
                        className="h-10 w-10 grid place-items-center rounded-full text-muted hover:text-danger hover:bg-danger-soft transition"
                        aria-label={`Eliminar ${category.name}`}
                      >
                        <LuTrash2 aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </ListGroup>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default CategoriesList;
