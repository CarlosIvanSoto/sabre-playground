"use client"

import * as React from "react"
import { useForm } from "@tanstack/react-form"
import { toast } from "sonner"
import * as z from "zod"
import { ChevronDown, ChevronUp, EyeIcon, EyeOffIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { createSession } from "@/services/sabre/auth/actions"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

const credentialsSchema = z.object({
  username: z.string().min(6, "Username must be at least 6 characters."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  organization: z.string().min(4, "PCC must be at least 4 characters."),
  domain: z.string(),
})

type ICredentialsFormProps = {
  initialData?: Partial<z.infer<typeof credentialsSchema>>
}

export function CredentialsForm(props: ICredentialsFormProps) {
  const [showAdvanced, setShowAdvanced] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)

  const form = useForm({
    defaultValues: {
      username: props.initialData?.username || "",
      password: props.initialData?.password || "",
      organization: props.initialData?.organization || "",
      domain: props.initialData?.domain || "",
    },
    validators: {
      onSubmit: credentialsSchema,
    },
    onSubmit: async ({ value }) => {
      // Filter out domain if not advanced
      const submissionData: {
        username: string;
        password: string;
        organization: string;
        domain?: string;
      } = { ...value }

      if (!showAdvanced) {
        delete submissionData.domain
      }

      try {
        await createSession(submissionData)
        toast("Session created successfully!")
      } catch (e) {
        toast("Failed to create session:", {
          description: e instanceof Error ? e.message : "Unknown error",
        })
      }
      return
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="w-full"
    >
      <FieldGroup>
        <form.Field
          name="username"
          children={(field) => {
            const isInvalid = field.state.meta.isTouched && field.state.meta.errors.length > 0
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="773400"
                  aria-invalid={isInvalid}
                />
                <FieldDescription>
                  This is your sabre APIs display name.
                </FieldDescription>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )
          }}
        />

        <form.Field
          name="password"
          children={(field) => {
            const isInvalid = field.state.meta.isTouched && field.state.meta.errors.length > 0
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Enter password"
                    type={showPassword ? "text" : "password"}
                    aria-invalid={isInvalid}
                  />
                  <InputGroupAddon align="inline-end" className="cursor-pointer" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription>
                  This is your sabre APIs password.
                </FieldDescription>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )
          }}
        />

        <form.Field
          name="organization"
          children={(field) => {
            const isInvalid = field.state.meta.isTouched && field.state.meta.errors.length > 0
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>PCC</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="7TZA"
                  aria-invalid={isInvalid}
                />
                <FieldDescription>
                  Your Sabre Pseudo City Code (PCC).
                </FieldDescription>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )
          }}
        />

        <Collapsible
          open={showAdvanced}
          onOpenChange={setShowAdvanced}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Advanced Options
            </span>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" type="button">
                {showAdvanced ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                <span className="sr-only">Toggle</span>
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <form.Field
              name="domain"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Domain</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="AA"
                      aria-invalid={isInvalid}
                    />
                    <FieldDescription>
                      Specify your application&apos;s Sabre audience.
                    </FieldDescription>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                )
              }}
            />
          </CollapsibleContent>
        </Collapsible>
      </FieldGroup>

      <Button type="submit" className="w-full mt-4">Submit</Button>
    </form>
  )
}
