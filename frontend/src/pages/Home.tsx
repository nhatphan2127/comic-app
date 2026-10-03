import HeaderLayout from "../layout/HeaderLayout/HeaderLayout.tsx"
import FooterLayout from '../layout/FooterLayout/FooterLayout.tsx'
import MainLayout from '../layout/MainLayout/MainLayout.tsx'


export default function Home() {
    return (
        <>
            <HeaderLayout></HeaderLayout>
            <MainLayout></MainLayout>
            <FooterLayout></FooterLayout>
        </>
    )
}