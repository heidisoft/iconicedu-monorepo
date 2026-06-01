'use client';

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
  type UIEvent,
} from 'react';
import { ChevronsUpDown } from 'lucide-react';

import { Button } from '@iconicedu/ui-web/ui/button';
import { Checkbox } from '@iconicedu/ui-web/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@iconicedu/ui-web/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@iconicedu/ui-web/ui/dialog';
import { Input } from '@iconicedu/ui-web/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@iconicedu/ui-web/ui/popover';
import { Textarea } from '@iconicedu/ui-web/ui/textarea';
import {
  type ClassRequestIntent,
  OTHER_SUBJECT_OPTION,
  STANDARD_SUBJECT_OPTIONS,
} from '@iconicedu/shared-types';

export interface ClassRequestableStudent {
  profileId: string;
  displayName: string;
}

export type ClassRequestRole = 'parents' | 'students' | 'other';

type ClassRequestFormState = {
  studentProfileIds: string[];
  subjects: string[];
  otherSubject: string;
  learningGoals: string;
  specialRequirements: string;
};

export type ClassRequestActionRenderProps = {
  openDialog: () => void;
  fallbackHref: string;
  canRequestClasses: boolean;
};

export interface ClassRequestActionProps {
  orgSlug: string;
  fallbackHref: string;
  canRequestClasses?: boolean;
  requestRole?: ClassRequestRole;
  requestableStudents?: ClassRequestableStudent[];
  subjectOptions?: string[];
  onClassRequestCreated?: (channelId: string) => void;
  renderTrigger: (props: ClassRequestActionRenderProps) => ReactNode;
}

const OTHER_SUBJECT_VALUE = OTHER_SUBJECT_OPTION;

const DEFAULT_SUBJECT_OPTIONS = [...STANDARD_SUBJECT_OPTIONS, OTHER_SUBJECT_VALUE];
const DEFAULT_CLASS_REQUEST_INTENT: ClassRequestIntent = 'ongoing-tutoring';

const createInitialFormState = (): ClassRequestFormState => ({
  studentProfileIds: [],
  subjects: [],
  otherSubject: '',
  learningGoals: '',
  specialRequirements: '',
});

function toggleSelectedValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function stopScrollEventPropagation(event: UIEvent<HTMLElement>) {
  event.stopPropagation();
}

function renderMultiSelectLabel(
  selectedValues: string[],
  options: Array<{ value: string; label: string }>,
  placeholder: string,
) {
  if (!selectedValues.length) {
    return placeholder;
  }

  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label);

  if (selectedLabels.length <= 2) {
    return selectedLabels.join(', ');
  }

  return `${selectedLabels.length} selected`;
}

export function ClassRequestAction({
  orgSlug,
  fallbackHref,
  canRequestClasses = false,
  requestRole = 'other',
  requestableStudents = [],
  subjectOptions = DEFAULT_SUBJECT_OPTIONS,
  onClassRequestCreated,
  renderTrigger,
}: ClassRequestActionProps) {
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isStudentSelectOpen, setIsStudentSelectOpen] = useState(false);
  const [isSubjectSelectOpen, setIsSubjectSelectOpen] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestForm, setRequestForm] =
    useState<ClassRequestFormState>(createInitialFormState);

  const isStudentRequest = requestRole === 'students';
  const studentOptions = requestableStudents.map((student) => ({
    value: student.profileId,
    label: student.displayName,
  }));
  const subjectSelectOptions = useMemo(() => {
    const merged = Array.from(
      new Map(
        [...subjectOptions, OTHER_SUBJECT_VALUE].map((subject) => [subject, subject]),
      ).values(),
    );
    return merged.map((subject) => ({
      value: subject,
      label: subject,
    }));
  }, [subjectOptions]);

  useEffect(() => {
    if (!isRequestDialogOpen || !canRequestClasses) {
      return;
    }

    setRequestForm((current) => {
      if (
        !isStudentRequest ||
        current.studentProfileIds.length > 0 ||
        !requestableStudents[0]
      ) {
        return current;
      }

      return {
        ...current,
        studentProfileIds: [requestableStudents[0].profileId],
      };
    });
  }, [canRequestClasses, isRequestDialogOpen, isStudentRequest, requestableStudents]);

  const handleRequestDialogOpenChange = (open: boolean) => {
    setIsRequestDialogOpen(open);
    setIsStudentSelectOpen(false);
    setIsSubjectSelectOpen(false);
    if (!open) {
      setRequestError(null);
      setRequestForm(createInitialFormState());
    }
  };

  const handleRequestSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!requestForm.studentProfileIds.length) {
      setRequestError('Select at least one student.');
      return;
    }

    if (!requestForm.subjects.length) {
      setRequestError('Select at least one subject.');
      return;
    }

    if (
      requestForm.subjects.includes(OTHER_SUBJECT_VALUE) &&
      !requestForm.otherSubject.trim().length
    ) {
      setRequestError('Enter the custom subject when "Other" is selected.');
      return;
    }

    setRequestError(null);
    setIsSubmittingRequest(true);

    try {
      const response = await fetch('/api/dashboard/class-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgSlug,
          requestIntent: DEFAULT_CLASS_REQUEST_INTENT,
          studentProfileIds: requestForm.studentProfileIds,
          subjects: requestForm.subjects,
          otherSubject: requestForm.otherSubject.trim() || null,
          learningGoals: requestForm.learningGoals.trim(),
          specialRequirements: requestForm.specialRequirements.trim() || null,
        }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
        channelId?: string;
      };

      if (!response.ok || !payload.success || !payload.channelId) {
        setRequestError(payload.message ?? 'Unable to create class request.');
        return;
      }

      handleRequestDialogOpenChange(false);
      if (onClassRequestCreated) {
        onClassRequestCreated(payload.channelId);
      } else {
        window.location.assign(`/${orgSlug}/c/${payload.channelId}`);
      }
    } catch {
      setRequestError('Unable to create class request.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const trigger = useMemo(
    () =>
      renderTrigger({
        openDialog: () => setIsRequestDialogOpen(true),
        fallbackHref,
        canRequestClasses,
      }),
    [renderTrigger, fallbackHref, canRequestClasses],
  );

  return (
    <>
      {trigger}
      <Dialog open={isRequestDialogOpen} onOpenChange={handleRequestDialogOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[63rem]">
          <DialogHeader>
            <DialogTitle>Explore Classes</DialogTitle>
            <DialogDescription>
              Tell us what you need, and we will match your family with the best tutors in
              the world to help your kids learn, grow, and thrive.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleRequestSubmit}>
            <div className="space-y-2">
              <label className="font-medium">
                Student name <span className="text-destructive">*</span>
              </label>
              <Popover open={isStudentSelectOpen} onOpenChange={setIsStudentSelectOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={isStudentSelectOpen}
                    className="w-full justify-between font-normal"
                    disabled={isStudentRequest}
                  >
                    <span className="truncate">
                      {renderMultiSelectLabel(
                        requestForm.studentProfileIds,
                        studentOptions,
                        'Select student(s)',
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="max-h-72 w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Search students..." />
                    <CommandList
                      className="max-h-60 overflow-y-auto overscroll-contain"
                      onWheel={stopScrollEventPropagation}
                      onTouchMove={stopScrollEventPropagation}
                    >
                      <CommandEmpty>No students found.</CommandEmpty>
                      {studentOptions.map((option) => {
                        const isSelected = requestForm.studentProfileIds.includes(
                          option.value,
                        );
                        return (
                          <CommandItem
                            key={option.value}
                            value={option.label}
                            className="rounded-none border-b border-border last:border-b-0 data-selected:bg-transparent hover:bg-transparent"
                            onSelect={() => {
                              setRequestForm((current) => ({
                                ...current,
                                studentProfileIds: toggleSelectedValue(
                                  current.studentProfileIds,
                                  option.value,
                                ),
                              }));
                            }}
                          >
                            <Checkbox
                              checked={isSelected}
                              className="pointer-events-none mr-2"
                            />
                            {option.label}
                          </CommandItem>
                        );
                      })}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="font-medium">
                Subject <span className="text-destructive">*</span>
              </label>
              <Popover open={isSubjectSelectOpen} onOpenChange={setIsSubjectSelectOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={isSubjectSelectOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">
                      {renderMultiSelectLabel(
                        requestForm.subjects,
                        subjectSelectOptions,
                        'Select subject(s)',
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="max-h-72 w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Search subjects..." />
                    <CommandList
                      className="max-h-60 overflow-y-auto overscroll-contain"
                      onWheel={stopScrollEventPropagation}
                      onTouchMove={stopScrollEventPropagation}
                    >
                      <CommandEmpty>No subjects found.</CommandEmpty>
                      {subjectSelectOptions.map((option) => {
                        const isSelected = requestForm.subjects.includes(option.value);
                        return (
                          <CommandItem
                            key={option.value}
                            value={option.label}
                            className="rounded-none border-b border-border last:border-b-0 data-selected:bg-transparent hover:bg-transparent"
                            onSelect={() => {
                              setRequestForm((current) => ({
                                ...current,
                                subjects: toggleSelectedValue(
                                  current.subjects,
                                  option.value,
                                ),
                              }));
                            }}
                          >
                            <Checkbox
                              checked={isSelected}
                              className="pointer-events-none mr-2"
                            />
                            {option.label}
                          </CommandItem>
                        );
                      })}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {requestForm.subjects.includes(OTHER_SUBJECT_VALUE) ? (
              <div className="space-y-2">
                <label className="font-medium" htmlFor="class-request-other-subject">
                  Other subject
                </label>
                <Input
                  id="class-request-other-subject"
                  value={requestForm.otherSubject}
                  onChange={(event) =>
                    setRequestForm((current) => ({
                      ...current,
                      otherSubject: event.target.value,
                    }))
                  }
                  placeholder="Enter custom subject"
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="font-medium" htmlFor="class-request-learning-goals">
                Learning goals
              </label>
              <p className="text-sm text-muted-foreground">
                What specific topics or skills should the tutor focus on?
              </p>
              <Textarea
                id="class-request-learning-goals"
                value={requestForm.learningGoals}
                onChange={(event) =>
                  setRequestForm((current) => ({
                    ...current,
                    learningGoals: event.target.value,
                  }))
                }
                placeholder="Describe the support you want"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <label className="font-medium" htmlFor="class-request-special-requirements">
                Special requirements
              </label>
              <p className="text-sm text-muted-foreground">
                Any accommodations, learning preferences, or other notes for the tutor.
              </p>
              <Textarea
                id="class-request-special-requirements"
                value={requestForm.specialRequirements}
                onChange={(event) =>
                  setRequestForm((current) => ({
                    ...current,
                    specialRequirements: event.target.value,
                  }))
                }
                placeholder="Optional notes"
                rows={4}
              />
            </div>

            {requestError ? (
              <p className="text-sm text-destructive">{requestError}</p>
            ) : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmittingRequest}>
                {isSubmittingRequest ? 'Submitting...' : 'Submit request'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
