import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "../../src/components/ui";

describe("Field", () => {
  it("connects the label to the input", () => {
    render(<Field label="City"><input className="input" /></Field>);
    expect(screen.getByLabelText("City").tagName).toBe("INPUT");
  });

  it("keeps an id the input already has", () => {
    render(<Field label="Pincode"><input id="pin" /></Field>);
    expect(screen.getByLabelText("Pincode")).toHaveAttribute("id", "pin");
  });

  it("shows the hint and links it for screen readers", () => {
    render(<Field label="Notes" hint="Optional"><textarea /></Field>);
    const box = screen.getByLabelText("Notes");
    expect(box).toHaveAccessibleDescription("Optional");
    expect(box).not.toHaveAttribute("aria-invalid");
  });

  it("an error replaces the hint, marks the input invalid and is announced", () => {
    render(<Field label="Address" hint="House no., street" error="Enter the full address"><textarea className="input" /></Field>);
    const box = screen.getByLabelText("Address");
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription("Enter the full address");
    expect(box.className).toMatch(/border-red-400/);
    expect(screen.getByRole("alert")).toHaveTextContent("Enter the full address");
    expect(screen.queryByText("House no., street")).not.toBeInTheDocument();
  });

  it("leaves complex children (several elements) alone", () => {
    render(
      <Field label="Photos">
        <div data-testid="picker">
          <input type="file" />
        </div>
      </Field>,
    );
    expect(screen.getByTestId("picker")).toBeInTheDocument();
    expect(screen.getByText("Photos").getAttribute("for")).toBeNull();
  });
});
