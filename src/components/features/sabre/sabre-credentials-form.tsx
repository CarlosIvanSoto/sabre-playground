"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"

const CredentialsSchema = z.object({
  username: z.string().min(6, {
    message: "Username must be at least 6 characters.",
  }),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
  organization: z.string().min(4, {
    message: "PCC must be at least 4 characters.",
  }),
  domain: z.string(),
})

export function SabreCredentialsForm() {
  const form = useForm<z.infer<typeof CredentialsSchema>>({
    resolver: zodResolver(CredentialsSchema),
    defaultValues: {
      username: "",
      password: "",
      organization: "",
      domain: "",
    },
  })

  function onSubmit(data: z.infer<typeof CredentialsSchema>) {
    toast("You submitted the following values:", {
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-2/3 space-y-6">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="773400" {...field} />
              </FormControl>
              <FormDescription>
                This is your sabre APIs display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input placeholder="password goes here" {...field} />
              </FormControl>
              <FormDescription>
                This is your sabre APIs password.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="organization"
          render={({ field }) => (
            <FormItem>
              <FormLabel>PCC</FormLabel>
              <FormControl>
                <Input placeholder="7TZA" {...field} />
              </FormControl>
              <FormDescription>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>This is your sabre APIs pseudo city code.</TooltipTrigger>
                    <TooltipContent>
                      <p>A PCC is an alphanumeric identifier used to identify a travel agency of a Global Distribution System (GDS)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="domain"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Domain</FormLabel>
              <FormControl>
                <Input placeholder="AA" {...field} />
              </FormControl>
              <FormDescription>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>This is your sabre APIs domain.</TooltipTrigger>
                    <TooltipContent>
                      <p>Used to specify your application&apos;s Sabre audience</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}
