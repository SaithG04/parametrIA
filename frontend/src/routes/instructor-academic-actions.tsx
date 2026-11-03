import { useState, type FormEvent } from "react";
import { ArchiveRestore, Pencil, ShieldAlert, UserRoundX, UserRoundCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormSelect } from "@/components/ui/form-select";
import { useSaveClassroom, useSaveCourse, useSetClassroomStatus, useSetCourseStatus } from "@/hooks/queries";
import type { Classroom, Course } from "@/services/types";

function StatusConfirmation({
  open,
  onOpenChange,
  name,
  kind,
  active,
  consequence,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  kind: "curso" | "aula";
  active: boolean;
  consequence: string;
  pending: boolean;
  onConfirm: (confirmationName: string, password: string) => void;
}) {
  const [confirmationName, setConfirmationName] = useState("");
  const [password, setPassword] = useState("");
  const deactivate = active;
  const reset = (nextOpen: boolean) => {
    if (!nextOpen) {
      setConfirmationName("");
      setPassword("");
    }
    onOpenChange(nextOpen);
  };

  return <Dialog open={open} onOpenChange={reset}>
    <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg rounded-2xl bg-white p-5 sm:p-6">
      <DialogHeader>
        <span className={`mb-1 grid size-10 place-items-center rounded-xl ${deactivate ? "bg-rose-50 text-rose-700" : "brand-soft"}`}>
          {deactivate ? <ShieldAlert className="size-5" /> : <ArchiveRestore className="size-5" />}
        </span>
        <DialogTitle>{deactivate ? `Desactivar ${kind}` : `Reactivar ${kind}`}</DialogTitle>
        <DialogDescription>
          {deactivate ? consequence : `El ${kind} volverá a estar disponible. ${kind === "curso" ? "Las aulas que se desactivaron junto con este curso seguirán desactivadas; podrás reactivarlas individualmente." : ""}`}
        </DialogDescription>
      </DialogHeader>
      <form className="grid gap-4" onSubmit={(event) => {
        event.preventDefault();
        onConfirm(confirmationName, password);
      }}>
        {deactivate && <>
          <label className="field">
            <span>Escribe exactamente el nombre de {kind}</span>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-800">{name}</span>
            <input
              required
              autoComplete="off"
              value={confirmationName}
              onChange={(event) => setConfirmationName(event.target.value)}
              placeholder={`Escribe: ${name}`}
            />
          </label>
          <label className="field">
            Confirma con tu contraseña actual
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        </>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="action secondary" onClick={() => reset(false)}>Cancelar</button>
          <button
            type="submit"
            className={deactivate ? "action danger" : "action"}
            disabled={pending || (deactivate && (confirmationName !== name || !password.trim()))}
          >
            {pending ? "Procesando…" : deactivate ? "Confirmar desactivación" : "Reactivar"}
          </button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}

export function CourseManagementCard({ course }: { course: Course }) {
  const save = useSaveCourse(course.id);
  const changeStatus = useSetCourseStatus();
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [name, setName] = useState(course.name);
  const [description, setDescription] = useState(course.description);

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate({ name: name.trim(), description: description.trim() }, {
      onSuccess: () => setEditOpen(false),
    });
  }

  return <>
    <article className={`rounded-xl border p-4 ${course.isActive ? "border-slate-200" : "border-amber-200 bg-amber-50/50"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{course.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${course.isActive ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
              {course.isActive ? "Activo" : "Desactivado"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{course.description || "Sin descripción"} · {course.classroomCount ?? 0} aulas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="action secondary px-3 py-2" onClick={() => { setName(course.name); setDescription(course.description); setEditOpen(true); }}>
            <Pencil aria-hidden="true" className="size-4" />Editar
          </button>
          <button type="button" className={course.isActive ? "action danger px-3 py-2" : "action secondary px-3 py-2"} onClick={() => setStatusOpen(true)}>
            {course.isActive ? <><UserRoundX aria-hidden="true" className="size-4" />Desactivar</> : <><UserRoundCheck aria-hidden="true" className="size-4" />Reactivar</>}
          </button>
        </div>
      </div>
    </article>
    <Dialog open={editOpen} onOpenChange={setEditOpen}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg rounded-2xl bg-white p-5 sm:p-6">
        <DialogHeader><DialogTitle>Editar curso</DialogTitle><DialogDescription>Los cambios se reflejarán en las aulas asociadas y conservarán sus matrículas e informes.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={submitEdit}>
          <label className="field">Nombre del curso<input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field">Descripción <span className="text-xs font-normal text-slate-500">(opcional)</span><textarea rows={3} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="action secondary" onClick={() => setEditOpen(false)}>Cancelar</button><button className="action" disabled={save.isPending}>{save.isPending ? "Guardando…" : "Guardar cambios"}</button></div>
        </form>
      </DialogContent>
    </Dialog>
    <StatusConfirmation
      open={statusOpen}
      onOpenChange={setStatusOpen}
      name={course.name}
      kind="curso"
      active={course.isActive}
      consequence="Se desactivarán también todas las aulas activas de este curso. Los estudiantes ya no podrán ingresar ni enviar documentos. El historial de matrículas e informes se conservará; no se elimina información."
      pending={changeStatus.isPending}
      onConfirm={(confirmationName, password) => changeStatus.mutate({
        id: course.id,
        isActive: !course.isActive,
        confirmationName,
        password,
      }, { onSuccess: () => setStatusOpen(false) })}
    />
  </>;
}

export function ClassroomManagementActions({
  classroom,
  courses,
  compact = false,
}: {
  classroom: Classroom;
  courses: Course[];
  compact?: boolean;
}) {
  const save = useSaveClassroom(classroom.id);
  const changeStatus = useSetClassroomStatus();
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [name, setName] = useState(classroom.name);
  const [courseId, setCourseId] = useState(classroom.courseId);
  const activeCourses = courses.filter((course) => course.isActive);
  const canReactivate = classroom.courseIsActive;

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate({ name: name.trim(), courseId }, { onSuccess: () => setEditOpen(false) });
  }

  return <>
    <div className={compact ? "col-span-2 grid grid-cols-2 gap-2" : "flex flex-wrap gap-2"}>
      <button type="button" className={`action secondary px-3 py-2 ${compact ? "w-full" : ""}`} onClick={() => { setName(classroom.name); setCourseId(classroom.courseId); setEditOpen(true); }} aria-label={`Editar aula ${classroom.name}`}>
        <Pencil aria-hidden="true" className="size-4" />Editar
      </button>
      <button type="button" className={`${classroom.isActive ? "action danger px-3 py-2" : "action secondary px-3 py-2"} ${compact ? "w-full" : ""}`} onClick={() => setStatusOpen(true)} aria-label={`${classroom.isActive ? "Desactivar" : "Reactivar"} aula ${classroom.name}`} disabled={!classroom.isActive && !canReactivate}>
        {classroom.isActive ? <><UserRoundX aria-hidden="true" className="size-4" />Desactivar</> : <><UserRoundCheck aria-hidden="true" className="size-4" />Reactivar</>}
      </button>
    </div>
    <Dialog open={editOpen} onOpenChange={setEditOpen}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg rounded-2xl bg-white p-5 sm:p-6">
        <DialogHeader><DialogTitle>Editar aula</DialogTitle><DialogDescription>Si cambias el curso, el aula y sus informes se conservarán bajo el nuevo curso.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={submitEdit}>
          <label className="field">Nombre del aula<input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field">Curso<FormSelect required value={courseId} options={activeCourses.map((course) => ({ value: course.id, label: course.name }))} onValueChange={setCourseId} /></label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="action secondary" onClick={() => setEditOpen(false)}>Cancelar</button><button className="action" disabled={save.isPending || !activeCourses.length}>{save.isPending ? "Guardando…" : "Guardar cambios"}</button></div>
        </form>
      </DialogContent>
    </Dialog>
    <StatusConfirmation
      open={statusOpen}
      onOpenChange={setStatusOpen}
      name={classroom.name}
      kind="aula"
      active={classroom.isActive}
      consequence="Los estudiantes ya no podrán acceder a esta aula ni enviar nuevos documentos. Las matrículas y los informes existentes se conservarán."
      pending={changeStatus.isPending}
      onConfirm={(confirmationName, password) => changeStatus.mutate({
        id: classroom.id,
        isActive: !classroom.isActive,
        confirmationName,
        password,
      }, { onSuccess: () => setStatusOpen(false) })}
    />
  </>;
}
