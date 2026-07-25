import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "../../lib/session";

async function logoutAction() {
  "use server";
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/");
}

/**
 * Layout partagé pour toutes les pages /admin (sauf /admin/login qui
 * est exclu du middleware et n'a pas besoin de ce chrome).
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="font-semibold text-slate-900 hover:text-slate-600">
              Mode édition
            </Link>
            <Link href="/admin/persons" className="text-slate-600 hover:text-slate-900">
              Personnes
            </Link>
            <Link href="/admin/unions" className="text-slate-600 hover:text-slate-900">
              Unions
            </Link>
            <Link href="/admin/filiations" className="text-slate-600 hover:text-slate-900">
              Filiations
            </Link>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </nav>
      {children}
    </>
  );
}
