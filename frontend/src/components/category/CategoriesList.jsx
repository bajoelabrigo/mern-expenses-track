import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LuChevronRight, LuPlus, LuTrash2 } from "react-icons/lu";
import {
  addDefaultCategoriesAPI,
  deleteCategoryAPI,
  listCategoriesAPI,
} from "../../services/category/categoryService";
import { incomeKindLabel, missingChurchKinds } from "../../lib/incomeKinds";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";
import { useWorkspace } from "../../hooks/useWorkspace";
import { Button, ButtonLink, Card, CategoryIcon, EmptyState, ListGroup, PageHeader } from "../ui";
import { capitalize } from "../ui/styles";

const GROUPS = [
  { type: "income", title: "Ingresos" },
  { type: "expense", title: "Gastos" },
];

const CategoriesList = () => {
  const queryClient = useQueryClient();
  const { can, workspace } = useWorkspace();
  const canWrite = can("category:write");
  const isChurch = workspace?.kind === "iglesia";

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

  //! Las categorías de fábrica que le falten a este espacio. Dos casos:
  //! - Un espacio sin ninguna (los que se crearon antes de que las pusiéramos
  //!   solas al crearlo): se le ofrecen todas.
  //! - Una iglesia a la que le borraron alguna de las de ingreso: esas, que son
  //!   las que hacen que los informes separen diezmos de ofrendas.
  const addDefaults = useMutation({
    mutationFn: addDefaultCategoriesAPI,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["list-categories"] }),
  });
  const sinNinguna = !isLoading && !isError && categories.length === 0;
  const faltanIngresos = isChurch && !isLoading && !isError ? missingChurchKinds(categories) : [];
  const faltanDefaults = canWrite && (sinNinguna || faltanIngresos.length > 0);
  const missingText = faltanIngresos.map((k) => k.plural).join(", ").replace(/, ([^,]*)$/, " y $1");

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
        {addDefaults.isError && <AlertMessage type="error" message={getErrorMessage(addDefaults.error)} />}

        {faltanDefaults && (
          <Card className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="font-bold text-ink">
                {sinNinguna ? "Sin categorías para empezar" : "Faltan categorías de iglesia"}
              </p>
              <p className="mt-1 text-sm text-ink-2">
                {sinNinguna
                  ? "Ponle las de siempre y anota desde ya. Después borras o cambias las que no uses."
                  : `${missingText}. Con ellas, los informes separan cada tipo de ingreso.`}
              </p>
            </div>
            <Button onClick={() => addDefaults.mutate()} disabled={addDefaults.isPending}>
              {addDefaults.isPending ? "Agregando…" : "Ponerlas"}
            </Button>
          </Card>
        )}

        {!isLoading && !isError && categories.length === 0 && !faltanDefaults && (
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
                        <span className="min-w-0">
                          <span className="block truncate">{capitalize(category.name)}</span>
                          {isChurch && category.incomeKind && (
                            <span className="block text-xs font-medium text-muted">
                              {incomeKindLabel(category.incomeKind)}
                            </span>
                          )}
                        </span>
                        <LuChevronRight aria-hidden="true" className="ml-auto text-muted shrink-0" />
                      </Link>
                    ) : (
                      <span className="flex-1 min-w-0 font-semibold text-ink">
                        <span className="block truncate">{capitalize(category.name)}</span>
                        {isChurch && category.incomeKind && (
                          <span className="block text-xs font-medium text-muted">
                            {incomeKindLabel(category.incomeKind)}
                          </span>
                        )}
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
