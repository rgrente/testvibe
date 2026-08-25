import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE_NAME, isValidSession, getAdminSecret } from "../../../lib/session";

/**
 * Server Action : vérifie le secret soumis et pose le cookie de
 * session si correct. Ne lève jamais l'erreur côté client pour ne pas
 * exposer d'informations.
 */
async function loginAction(formData: FormData) {
  "use server";
  const entered = formData.get("secret")?.toString() ?? "";
  const adminSecret = getAdminSecret();

  if (isValidSession(entered, adminSecret)) {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, entered, {
      httpOnly: true,
      sameSite: "lax",
      path: "/admin",
      // En production, ajouter secure: true via une variable d'env
      secure: process.env.NODE_ENV === "production",
    });
    redirect("/admin");
  }
  // En cas d'échec, on redirige vers la page de login avec un flag d'erreur
  redirect("/admin/login?error=1");
}

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Mode édition — connexion</h1>

      {error && (
        <p className="mb-4 rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          Secret incorrect. Réessayez.
        </p>
      )}

      <form action={loginAction} className="flex flex-col gap-4">
        <label htmlFor="secret" className="block text-sm font-medium text-slate-700">
          Secret admin
        </label>
        <input
          id="secret"
          name="secret"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-sm border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-500"
          placeholder="Entrez le secret défini dans ADMIN_SECRET"
        />
        <button
          type="submit"
          className="rounded-sm bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Se connecter
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-500">
        <Link href="/" className="underline hover:text-slate-800">
          ← Retour à la consultation
        </Link>
      </p>
    </main>
  );
}
