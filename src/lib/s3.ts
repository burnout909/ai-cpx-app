import { S3Client } from "@aws-sdk/client-s3"

const s3Client = new S3Client({
    region: process.env.NEXT_PUBLIC_S3_REGION,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_KEY as string,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET as string
    }
})

export default s3Client