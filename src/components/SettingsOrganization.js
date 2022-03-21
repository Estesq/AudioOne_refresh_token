import React, { useState } from "react";
import Form from "react-bootstrap/Form";
import FormField from "components/FormField";
import Button from "react-bootstrap/Button";
import Spinner from "react-bootstrap/Spinner";
import { useAuth } from "util/auth.js";
import { useForm } from "react-hook-form";
import { useEffect } from "react";

function SettingsOrganization(props) {
    const auth = useAuth();
    const [pending, setPending] = useState(false);
    const [organizations, setOrganizations] = useState()

    const handleData = async () => {
        await setOrganizations(await auth.getOrganizations())
        console.log(organizations)
    }

    useEffect(() => {
        handleData()
    }, [pending])


    const { register, handleSubmit, errors, reset, getValues } = useForm();

    const onSubmit = (data) => {
        // Show pending indicator
        console.log("test org-2")
        console.log(data)
        setPending(true);
        auth.createOrganization(data).then(() => {
            // Clear form
            reset();
            // Set success status
            props.onStatus({
                type: "success",
                message: "Organization added.",
            });
        })
            .catch((error) => {
                if (error.code === "auth/requires-recent-login") {
                    // Update state to show re-authentication modal
                    props.onStatus({
                        type: "requires-recent-login",
                        // Resubmit after reauth flow
                        callback: () => onSubmit({ pass: data.pass }),
                    });
                } else {
                    // Set error status
                    props.onStatus({
                        type: "error",
                        message: error.message,
                    });
                }
            })
            .finally(() => {
                // Hide pending indicator
                setPending(false);
            });
    };

    return (
        <>
            <Form onSubmit={handleSubmit(onSubmit)}>
                <Form.Group controlId="formName">
                    <FormField
                        name="name"
                        type="text"
                        label="Name"
                        placeholder="Name"
                        size="lg"
                        error={errors.name}
                        inputRef={register({
                            required: "Please enter a name",
                        })}
                    />
                </Form.Group>
                <Form.Group controlId="formName">
                    <FormField
                        name="display_name"
                        type="text"
                        label="Display Name"
                        placeholder="Display Name"
                        size="lg"
                        error={errors.display_name}
                        inputRef={register({
                            required: "Please enter a display name",
                        })}
                    />
                </Form.Group>
                <Button type="submit" size="lg" disabled={pending}>
                    <span>Save</span>

                    {pending && (
                        <Spinner
                            animation="border"
                            size="sm"
                            role="status"
                            aria-hidden={true}
                            className="ml-2 align-baseline"
                        >
                            <span className="sr-only">Sending...</span>
                        </Spinner>
                    )}
                </Button>
            </Form>
            {
                organizations && !organizations.error ? (
                    organizations.map(el =>
                        <div style={{ display: "flex", padding: "15px 0", justifyContent: "space-between" }}>
                            <div>{el.name}</div>
                            <div>{el.display_name}</div>
                        </div>)
                ) : null
            }
        </>
    );
}

export default SettingsOrganization;
