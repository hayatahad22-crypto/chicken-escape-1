import { useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import { Html, OrbitControls, useFBX, useTexture } from "@react-three/drei";
import { useGameLogic } from "hooks/useGameLogic";

function Ground() {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, 0, 0]}>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial color="#90EE90" />
    </mesh>
  );
}

function Fryer({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#8B0000" />
    </mesh>
  );
}

interface ChickenEscape3DProps {
  gameMode?: string;
}

export default function ChickenEscape3D({ gameMode }: ChickenEscape3DProps) {
  const groupRef = useRef<Group>(null);
  const { camera } = useThree();
  const mode: "solo" | "team" = gameMode === "team" ? "team" : "solo";

  const { jump, playJumpSound, playHitSound } = useGameLogic(mode);

  // FBX
  const fbx = useFBX("/chiken/source/петух.fbx");
  const texture = useTexture("/chiken/textures/утка.png");

  // Player position
  const [playerPos, setPlayerPos] = useState<[number, number, number]>([
    0, 0, 0,
  ]);
  const [playerHealth, setPlayerHealth] = useState(100);
  const [velocityY, setVelocityY] = useState(0);
  const [onGround, setOnGround] = useState(true);

  // Fryer position
  const [fryerPos, setFryerPos] = useState<[number, number, number]>([
    0, 0, -20,
  ]);

  // Solo obstacles - removed for field runner
  const [obstacles, setObstacles] = useState<Array<[number, number, number]>>(
    []
  );

  // Boss mode
  const [bossHealth, setBossHealth] = useState(4000);
  const [projectiles, setProjectiles] = useState<Array<{
    position: [number, number, number];
    headshot: boolean;
  }>>([]);
  const [aiProjectiles, setAiProjectiles] = useState<Array<{
    position: [number, number, number];
  }>>([]);

  // Controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (mode === "solo") {
        if (e.key === "ArrowLeft")
          setPlayerPos([playerPos[0] - 1, playerPos[1], playerPos[2]]);
        if (e.key === "ArrowRight")
          setPlayerPos([playerPos[0] + 1, playerPos[1], playerPos[2]]);
        if (e.code === "Space" && onGround) {
          setVelocityY(0.2);
          setOnGround(false);
          playJumpSound();
        }
      } else {
        if (e.key === "ArrowLeft")
          setPlayerPos([playerPos[0] - 1, playerPos[1], playerPos[2]]);
        if (e.key === "ArrowRight")
          setPlayerPos([playerPos[0] + 1, playerPos[1], playerPos[2]]);
        if (e.key.toLowerCase() === "f") {
          setProjectiles((p) => [
            ...p,
            {
              position: [playerPos[0], playerPos[1] + 1, playerPos[2]] as [
                number,
                number,
                number
              ],
              headshot: Math.random() < 0.2,
            },
          ]);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [playerPos, onGround, jump, mode, playJumpSound]);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lane, playerPos, jump, mode]);

  // Game loop
  useFrame((state, delta) => {
    // Move player forward continuously in solo mode
    if (mode === "solo") {
      setPlayerPos((prev) => [prev[0], prev[1], prev[2] - delta * 10]);

      // Gravity and jump
      setVelocityY((vy) => vy + -0.01);
      setPlayerPos((prev) => {
        const newY = prev[1] + velocityY;
        if (newY <= 0) {
          setVelocityY(0);
          setOnGround(true);
          return [prev[0], 0, prev[2]];
        }
        return [prev[0], newY, prev[2]];
      });

      // Move fryer towards player
      setFryerPos((prev) => {
        const dx = playerPos[0] - prev[0];
        const dz = playerPos[2] - prev[2];
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 2) {
          const speed = 0.05;
          return [
            prev[0] + (dx / dist) * speed,
            prev[1],
            prev[2] + (dz / dist) * speed,
          ];
        }
        return prev;
      });

      // Check collision with fryer
      const distToFryer = Math.sqrt(
        (playerPos[0] - fryerPos[0]) ** 2 + (playerPos[2] - fryerPos[2]) ** 2
      );
      if (distToFryer < 2) {
        setPlayerHealth(0);
      }

      // Update camera to follow player
      camera.position.set(playerPos[0], 8, playerPos[2] + 12);
      camera.lookAt(playerPos[0], 0, playerPos[2]);
    } else {
      // Projectiles move
      setProjectiles((p) =>
        p
          .map((proj) => ({
            position: [
              proj.position[0],
              proj.position[1],
              proj.position[2] - 0.5,
            ] as [number, number, number],
            headshot: proj.headshot,
          }))
          .filter((proj) => proj.position[2] > -50)
      );
      setAiProjectiles((p) =>
        p
          .map((proj) => ({
            position: [
              proj.position[0],
              proj.position[1],
              proj.position[2] + 0.3,
            ] as [number, number, number],
          }))
          .filter((proj) => proj.position[2] < 10)
      );

      // Check projectile hits on boss
      projectiles.forEach((proj) => {
        if (proj.position[2] < -10) {
          setBossHealth((hp) => hp - (proj.headshot ? 400 : 100));
        }
      });

      // AI hits player
      aiProjectiles.forEach((proj) => {
        if (
          Math.abs(proj.position[0] - playerPos[0]) < 0.5 &&
          Math.abs(proj.position[2]) < 1
        ) {
          setPlayerHealth((hp) => Math.max(hp - 30, 0));
        }
      });
    }
  });

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight intensity={0.6} position={[5, 10, 5]} />
      <group ref={groupRef}>
        <Ground />
        <primitive
          object={fbx}
          position={playerPos}
          scale={[0.02, 0.02, 0.02]}
        >
          <meshStandardMaterial map={texture} />
        </primitive>

        {mode === "solo" && <Fryer position={fryerPos} />}

        {mode === "team" && <Fryer position={[0, 0, -10]} />}
      </group>

      {mode === "team" &&
        projectiles.map((proj, i) => (
          <mesh key={i} position={proj.position}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color={proj.headshot ? "yellow" : "blue"} />
          </mesh>
        ))}

      {mode === "team" &&
        aiProjectiles.map((proj, i) => (
          <mesh key={i} position={proj.position}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color="green" />
          </mesh>
        ))}

      <Html>
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            color: "white",
            fontSize: "20px",
          }}
        >
          {mode === "solo"
            ? `Player Health: ${playerHealth}`
            : `Boss Health: ${bossHealth}`}
        </div>
        {playerHealth <= 0 && (
          <div style={{ color: "red", fontSize: "40px" }}>You Lose!</div>
        )}
        {mode === "team" && bossHealth <= 0 && (
          <div style={{ color: "green", fontSize: "40px" }}>You Win!</div>
        )}
      </Html>

      {mode === "solo" && <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />}
      {mode === "team" && <OrbitControls enablePan enableZoom enableRotate />}
    </>
  );
}
