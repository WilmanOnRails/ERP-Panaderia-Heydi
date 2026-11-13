"use client"

import SwaggerUI from "swagger-ui-react"
import "swagger-ui-react/swagger-ui.css"

export default function ApiDocsPage() {
  return (
    <main>
      <SwaggerUI url="/api/openapi" />
    </main>
  )
}
