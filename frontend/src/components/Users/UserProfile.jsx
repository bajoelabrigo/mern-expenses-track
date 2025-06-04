import React, { useState } from "react";
import { Link } from "react-router-dom";
import ProfileForm from "./ProfileForm";
import UpdatePasswordForm from "./UpdatePasswordForm";

const UserProfile = () => {
  const [openTab, setOpenTab] = useState();

  const activeClasses = "text-blue-500 border-blue-500";
  const inactiveClasses = "border-transparent";

  return (
    <div className="w-fulll rounded-sm border border-gray-50 bg-white py-7 px-20 shadow-lg">
      {/*Buttons for tabs */}
      <div className="mb-6 flex flex-wrap gap-5 border-b border-gray-50 sm:gap-10">
        <Link
          to="#"
          className={`border-b-2 py-4 text-sm font-medium hover:text-blue-500 md:text-base ${
            openTab === 1 ? activeClasses : inactiveClasses
          }`}
          onClick={() => {
            setOpenTab(1);
          }}
        >
          Actualizar Perfil
        </Link>
        <Link
          to="#"
          className={`border-b-2 py-4 text-sm font-medium hover:text-blue-500 md:text-base ${
            openTab === 2 ? activeClasses : inactiveClasses
          }`}
          onClick={() => {
            setOpenTab(2);
          }}
        >
          Actualizar Password
        </Link>
      </div>
      {/*Contents for tabs */}
      <div className="">
        <div className={`${openTab === 1 ? "block" : "hidden"}`}>
          {/*Profile form */}
          <ProfileForm />
        </div>
        <div className={`${openTab === 2 ? "block" : "hidden"}`}>
          {/*Update password form */}
          <UpdatePasswordForm />
        </div>
      </div>
      <div></div>
    </div>
  );
};

export default UserProfile;
