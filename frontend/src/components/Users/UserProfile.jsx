import { useState } from "react";
import ProfileForm from "./ProfileForm";
import UpdatePasswordForm from "./UpdatePasswordForm";

const TABS = [
  { id: "perfil", label: "Actualizar perfil" },
  { id: "password", label: "Actualizar contraseña" },
];

const UserProfile = () => {
  //! Antes iniciaba en undefined y no se veía ninguna pestaña
  const [openTab, setOpenTab] = useState("perfil");

  return (
    <div className="w-full rounded-sm border border-gray-100 bg-white py-7 px-4 sm:px-10 lg:px-20 shadow-lg">
      <div className="mb-6 flex flex-wrap gap-5 border-b border-gray-100 sm:gap-10">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setOpenTab(tab.id)}
            aria-current={openTab === tab.id}
            className={`border-b-2 py-4 text-sm font-medium hover:text-blue-500 md:text-base ${
              openTab === tab.id
                ? "text-blue-500 border-blue-500"
                : "border-transparent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {openTab === "perfil" ? <ProfileForm /> : <UpdatePasswordForm />}
    </div>
  );
};

export default UserProfile;
