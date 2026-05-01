"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  FEATURE_KEYS,
  FEATURE_MODULE_LABELS,
  GATE_ROLE_FORCED_OFF_FEATURES,
  defaultFeaturePermissionsForRole,
  fullAccessPermissions,
  type FeatureKey,
  type FeaturePermissionMap,
} from "@/lib/access";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import {
  deleteRecentInvitedUserAction,
  inviteTeamMemberAction,
  updateTeamMemberAction,
} from "@/app/(main)/settings/team-actions";
import type { MemberRole, PlanTier } from "@/types/database";

const GATE_OFF_SET = new Set<FeatureKey>(GATE_ROLE_FORCED_OFF_FEATURES);

export type TeamMemberRow = {
  membershipId: string;
  userId: string;
  /** Profile display name (may be empty until they set it). */
  displayName: string | null;
  email: string | null;
  role: MemberRole;
  isCompanyAdmin: boolean;
  isActive: boolean;
  permissions: FeaturePermissionMap;
  isAccountOwner: boolean;
  canDeleteInvitedAccount: boolean;
};

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-[var(--border)]"
      />
      <span>{label}</span>
    </label>
  );
}

export function TeamPanel(props: {
  planTier: PlanTier;
  members: TeamMemberRow[];
  viewerUserId: string;
  canAssignCompanyAdmin: boolean;
  /** Active company admins on the current company only (account owner excluded). */
  thisCompanyAdminUsed: number;
  thisCompanyAdminMax: number;
  /** Distinct company-admin users on the subscription (owner excluded). */
  accountAdminUsed: number;
  accountAdminMax: number;
  /** Distinct active users on the subscription (all companies). */
  accountPeopleUsed: number;
  accountPeopleMax: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inviteName, setInviteName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("office");
  const [addAdmin, setAddAdmin] = useState(false);
  const [addPerms, setAddPerms] = useState<FeaturePermissionMap>(() => defaultFeaturePermissionsForRole("office"));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const thisCompanyAdminInviteBlocked =
    props.thisCompanyAdminMax > 0 && props.thisCompanyAdminUsed >= props.thisCompanyAdminMax;
  const accountCompanyAdminFull =
    props.accountAdminMax > 0 && props.accountAdminUsed >= props.accountAdminMax;
  /** Per-company admin count at plan UI cap (Pro: 1, Max: 5). Account-wide cap is enforced on the server. */
  const inviteCompanyAdminBlocked = thisCompanyAdminInviteBlocked;

  /** Company admin is not offered for the gate / security preset. */
  const showInviteCompanyAdmin = props.canAssignCompanyAdmin && role !== "gate";

  const allowMemberDeactivation = props.planTier === "pro" || props.planTier === "max";

  const [editing, setEditing] = useState<TeamMemberRow | null>(null);
  const [editRole, setEditRole] = useState<MemberRole>("office");
  const [editAdmin, setEditAdmin] = useState(false);
  const [editActive, setEditActive] = useState(true);
  const [editPerms, setEditPerms] = useState<FeaturePermissionMap>(fullAccessPermissions());

  const viewerIsAccountOwner = props.members.some(
    (m) => m.userId === props.viewerUserId && m.isAccountOwner,
  );

  const isSelfEdit = editing != null && editing.userId === props.viewerUserId;
  const blockSelfCompanyAdminDemote =
    isSelfEdit && !!editing?.isCompanyAdmin && !viewerIsAccountOwner;
  const blockSelfDeactivate = isSelfEdit;

  const editingBlocksPromotingToCompanyAdmin =
    editing != null &&
    !editing.isCompanyAdmin &&
    ((props.planTier === "pro" &&
      props.members.some(
        (m) =>
          m.membershipId !== editing.membershipId &&
          m.isCompanyAdmin &&
          !m.isAccountOwner &&
          m.isActive,
      )) ||
      (props.planTier === "max" &&
        props.thisCompanyAdminMax > 0 &&
        props.thisCompanyAdminUsed >= props.thisCompanyAdminMax));

  const showEditCompanyAdmin = props.canAssignCompanyAdmin && editRole !== "gate";

  function openEdit(m: TeamMemberRow) {
    setEditError(null);
    setEditing(m);
    setEditRole(m.role);
    setEditAdmin(m.isCompanyAdmin && m.role !== "gate");
    setEditActive(m.isActive);
    setEditPerms({ ...m.permissions });
  }

  function closeEdit() {
    setEditError(null);
    setEditing(null);
  }

  return (
    <div className="space-y-10">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="font-medium">Invite teammate by email</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Send email invites to create a new user (they choose a password on first link) or add existing users (if email
          already has an account). Set which user gets access to which module, and use company-admin seats (limited)
          carefully.
        </p>
        {success ? (
          <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
            {success}
          </p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setSuccess(null);
            startTransition(async () => {
              try {
                const perms = addAdmin && showInviteCompanyAdmin ? fullAccessPermissions() : addPerms;
                const result = await inviteTeamMemberAction({
                  email,
                  inviteDisplayName: inviteName.trim() || undefined,
                  role,
                  isCompanyAdmin:
                    addAdmin && showInviteCompanyAdmin && props.canAssignCompanyAdmin && !inviteCompanyAdminBlocked,
                  permissions: perms,
                });
                setInviteName("");
                setEmail("");
                setAddAdmin(false);
                setRole("office");
                setAddPerms(defaultFeaturePermissionsForRole("office"));
                setSuccess(
                  result.outcome === "invited"
                    ? "Invitation sent. They should check email and complete password setup."
                    : "That person already had an account — they were added to this company. Ask them to sign in.",
                );
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not invite member");
              }
            });
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">E-mail</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
              placeholder="colleague@company.com"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Name</span>
            <input
              type="text"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              autoComplete="name"
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
              placeholder="Their full name — they can edit this after sign-in"
            />
            <span className="text-xs text-[var(--muted)]">
              If you leave this blank, we use their email until they set a name in Profile. For brand-new invites, a name
              you enter is saved to their profile when they accept.
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Preset role</span>
            <select
              value={role}
              onChange={(e) => {
                const r = e.target.value as MemberRole;
                setRole(r);
                if (r === "gate") {
                  setAddAdmin(false);
                  setAddPerms(defaultFeaturePermissionsForRole("gate"));
                } else if (!addAdmin) {
                  setAddPerms(defaultFeaturePermissionsForRole(r));
                }
              }}
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
            >
              <option value="office">Office</option>
              <option value="gate">Gate / security</option>
            </select>
          </label>
          {showInviteCompanyAdmin ? (
            <div className="space-y-1">
              <Toggle
                label="Company admin (can manage this company’s team and permissions)"
                checked={addAdmin}
                disabled={pending || inviteCompanyAdminBlocked}
                onChange={(v) => {
                  setAddAdmin(v);
                  if (v) setAddPerms(fullAccessPermissions());
                  else setAddPerms((p) => ({ ...p, settings_company: false }));
                }}
              />
              {thisCompanyAdminInviteBlocked ? (
                <p className="text-xs text-[var(--muted)]">
                  {props.planTier === "pro"
                    ? "This company already has its company admin. Demote them first to assign another."
                    : "This company is at the maximum number of company admins shown for your plan. Demote someone first to add another."}
                </p>
              ) : null}
              {accountCompanyAdminFull && !thisCompanyAdminInviteBlocked ? (
                <p className="text-xs text-[var(--muted)]">
                  You’ve used all company-admin seats on your plan (counted across every company).
                </p>
              ) : null}
            </div>
          ) : null}
          {!addAdmin || !showInviteCompanyAdmin ? (
            <fieldset className="space-y-2 rounded-md border border-[var(--border)] p-3">
              <legend className="px-1 text-sm font-medium">Module access</legend>
              {!addAdmin ? (
                <p className="text-xs text-[var(--muted)]">
                  Company profile is only for company admins (enable that option above when your plan allows it, or promote
                  the member later).
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {FEATURE_KEYS.map((k) => (
                  <Toggle
                    key={k}
                    label={FEATURE_MODULE_LABELS[k]}
                    checked={addPerms[k]}
                    disabled={
                      pending ||
                      (role === "gate" && GATE_OFF_SET.has(k)) ||
                      (k === "settings_company" && !addAdmin) ||
                      (k === "visitor_checkpoint" && !addPerms.visitor) ||
                      (k === "material_movement" && !addPerms.gate_pass)
                    }
                    onChange={(v) => {
                      if (k === "visitor") {
                        setAddPerms((p) => ({
                          ...p,
                          visitor: v,
                          visitor_checkpoint: v ? p.visitor_checkpoint : false,
                        }));
                        return;
                      }
                      if (k === "gate_pass") {
                        setAddPerms((p) => ({
                          ...p,
                          gate_pass: v,
                          material_movement: v ? p.material_movement : false,
                        }));
                        return;
                      }
                      setAddPerms((p) => ({ ...p, [k]: v }));
                    }}
                  />
                ))}
              </div>
            </fieldset>
          ) : null}
          <button type="submit" disabled={pending} className={primaryButtonMd + " w-fit"}>
            {pending ? "Sending…" : "Send invite"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-medium">People on this company</h2>
        <div className="mt-1 space-y-2 text-sm text-[var(--muted)]">
          {props.thisCompanyAdminMax > 0 ? (
            <>
              <p>
                Company admins on this company (account owner not counted):{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {props.thisCompanyAdminUsed} / {props.thisCompanyAdminMax}
                </span>
              </p>
              <p>
                Company-admin seats on your plan:{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {props.accountAdminUsed} / {props.accountAdminMax}
                </span>
              </p>
              {props.planTier === "pro" ? (
                <p className="text-xs leading-relaxed">
                  Note: On Pro, only one company admin per company. The same person can be company admin on both
                  companies. The same person still counts once toward the total seats.
                </p>
              ) : null}
              {props.planTier === "max" ? (
                <p className="text-xs leading-relaxed">
                  On Max, you can have more than one company admin in a single company (for example by department or
                  vertical). The seat total above still applies across all companies.
                </p>
              ) : null}
            </>
          ) : (
            <p>Company admin seats are not included on your current plan.</p>
          )}
          <p>
            People on this account (all companies under your plan share this limit):{" "}
            <span className="font-medium text-[var(--foreground)]">
              {props.accountPeopleUsed} / {props.accountPeopleMax}
            </span>
          </p>
          {props.planTier !== "free" ? (
            <p className="text-xs leading-relaxed">
              For access or billing questions, contact your account owner (master admin).
            </p>
          ) : null}
        </div>
        {listError ? <p className="mt-2 text-sm text-red-600">{listError}</p> : null}
        <ul className="mt-4 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--card)]">
          {props.members.map((m) => {
            const nameText = m.displayName?.trim() ? m.displayName.trim() : "—";
            const rightsParts: string[] = [];
            if (m.isAccountOwner) rightsParts.push("Account owner (master admin)");
            else if (m.isCompanyAdmin) rightsParts.push("Company admin");
            else rightsParts.push(m.role === "gate" ? "Gate / security" : "Office");
            if (!m.isActive) rightsParts.push("inactive");
            const rightsText = rightsParts.join(" · ");
            return (
              <li
                key={m.membershipId}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm first:rounded-t-lg last:rounded-b-lg sm:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-medium text-[var(--foreground)]">{nameText}</span>
                    <span className="text-xs text-[var(--muted)]">{rightsText}</span>
                  </div>
                </div>
                {!m.isAccountOwner ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className="whitespace-nowrap rounded-md border border-[var(--border)] px-2.5 py-1 text-xs hover:bg-[var(--border)] sm:text-sm"
                      onClick={() => openEdit(m)}
                    >
                      Edit access
                    </button>
                    {m.canDeleteInvitedAccount ? (
                      <button
                        type="button"
                        className="whitespace-nowrap rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-900 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/70 sm:text-sm"
                        disabled={pending}
                        onClick={() => {
                          if (
                            !confirm(
                              "Permanently delete this person’s login? Only use for recent invites who have not created any documents. This cannot be undone.",
                            )
                          ) {
                            return;
                          }
                          setListError(null);
                          startTransition(async () => {
                            try {
                              await deleteRecentInvitedUserAction({ targetUserId: m.userId });
                              router.refresh();
                            } catch (err) {
                              setListError(err instanceof Error ? err.message : "Could not delete account");
                            }
                          });
                        }}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg">
            <h3 className="text-lg font-semibold">Edit access</h3>
            <div className="mt-1 space-y-1 text-sm text-[var(--muted)]">
              <p>
                <span className="text-[var(--muted)]">Name: </span>
                <span className="text-[var(--foreground)]">
                  {editing.displayName?.trim() ? editing.displayName.trim() : "—"}
                </span>
              </p>
              <p className="break-all">
                <span className="text-[var(--muted)]">Email: </span>
                <span className="text-[var(--foreground)]">{editing.email ?? "—"}</span>
              </p>
            </div>
            {editError ? <p className="mt-2 text-sm text-red-600">{editError}</p> : null}
            <div className="mt-4 space-y-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--muted)]">Role</span>
                <select
                  value={editRole}
                  onChange={(e) => {
                    const r = e.target.value as MemberRole;
                    if (blockSelfCompanyAdminDemote && r === "gate") return;
                    setEditRole(r);
                    if (r === "gate") {
                      setEditAdmin(false);
                      setEditPerms(defaultFeaturePermissionsForRole("gate"));
                    } else if (!editAdmin) {
                      setEditPerms(defaultFeaturePermissionsForRole(r));
                    }
                  }}
                  className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                >
                  <option value="office">Office</option>
                  <option value="gate" disabled={blockSelfCompanyAdminDemote}>
                    Gate / security
                  </option>
                </select>
              </label>
              {blockSelfCompanyAdminDemote ? (
                <p className="text-xs text-[var(--muted)]">
                  Only the account owner can remove your company admin role.
                </p>
              ) : null}
              {showEditCompanyAdmin ? (
                <div className="space-y-1">
                  <Toggle
                    label="Company admin"
                    checked={editAdmin}
                    disabled={
                      (editingBlocksPromotingToCompanyAdmin && !editAdmin) ||
                      (blockSelfCompanyAdminDemote && editAdmin)
                    }
                    onChange={(v) => {
                      if (blockSelfCompanyAdminDemote && !v) return;
                      setEditAdmin(v);
                      if (!v) setEditPerms((p) => ({ ...p, settings_company: false }));
                    }}
                  />
                  {editingBlocksPromotingToCompanyAdmin && !editAdmin ? (
                    <p className="text-xs text-[var(--muted)]">
                      {props.planTier === "pro"
                        ? "This company already has a company admin. Demote them first to assign another."
                        : "This company is at the maximum number of company admins for your plan. Demote someone first to promote someone else."}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {allowMemberDeactivation ? (
                <div className="space-y-1">
                  <Toggle
                    label="Active — can sign in and use this company"
                    checked={editActive}
                    onChange={(v) => {
                      if (blockSelfDeactivate && editing.isActive && !v) return;
                      setEditActive(v);
                    }}
                  />
                  {blockSelfDeactivate && editing.isActive ? (
                    <p className="text-xs text-[var(--muted)]">
                      You cannot deactivate your own access. Another company admin or the account owner can do that for
                      you.
                    </p>
                  ) : null}
                  <p className="text-xs leading-relaxed text-[var(--muted)]">
                    When someone leaves the company, turn off to deactivate user. Deactivated users cannot access the
                    app.
                    Deactivation also vacates the user from your user limit / quota. Documents they created will only be
                    visible to the account owner (master admin) and company admins.
                  </p>
                </div>
              ) : (
                <p className="text-xs leading-relaxed text-[var(--muted)]">
                  Member deactivation (free a seat without deleting history) is available on Pro and Max.
                </p>
              )}
              {!editAdmin || !showEditCompanyAdmin ? (
                <fieldset className="space-y-2 rounded-md border border-[var(--border)] p-3">
                  <legend className="px-1 text-sm font-medium">Module access</legend>
                  {!editAdmin ? (
                    <p className="text-xs text-[var(--muted)]">
                      Company profile is only for company admins — turn on Company admin above when allowed, or ask the
                      account owner to assign a company-admin seat.
                    </p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {FEATURE_KEYS.map((k) => (
                      <Toggle
                        key={k}
                        label={FEATURE_MODULE_LABELS[k]}
                        checked={editPerms[k]}
                        disabled={
                          pending ||
                          (editRole === "gate" && GATE_OFF_SET.has(k)) ||
                          (k === "settings_company" && !editAdmin) ||
                          (k === "visitor_checkpoint" && !editPerms.visitor) ||
                          (k === "material_movement" && !editPerms.gate_pass)
                        }
                        onChange={(v) => {
                          if (k === "visitor") {
                            setEditPerms((p) => ({
                              ...p,
                              visitor: v,
                              visitor_checkpoint: v ? p.visitor_checkpoint : false,
                            }));
                            return;
                          }
                          if (k === "gate_pass") {
                            setEditPerms((p) => ({
                              ...p,
                              gate_pass: v,
                              material_movement: v ? p.material_movement : false,
                            }));
                            return;
                          }
                          setEditPerms((p) => ({ ...p, [k]: v }));
                        }}
                      />
                    ))}
                  </div>
                </fieldset>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                className={primaryButtonMd}
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      setEditError(null);
                      await updateTeamMemberAction({
                        membershipId: editing.membershipId,
                        role: editRole,
                        isCompanyAdmin:
                          editRole !== "gate" && editAdmin && props.canAssignCompanyAdmin,
                        isActive: allowMemberDeactivation ? editActive : true,
                        permissions:
                          editRole !== "gate" && editAdmin ? fullAccessPermissions() : editPerms,
                      });
                      closeEdit();
                      router.refresh();
                    } catch (err) {
                      setEditError(err instanceof Error ? err.message : "Update failed");
                    }
                  });
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                onClick={closeEdit}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
