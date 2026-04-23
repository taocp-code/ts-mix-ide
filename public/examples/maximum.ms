X       equ 1000
        orig X+1
        con 47
        con 15
        con 799
        con 82
        con 100
        con 93
        con 122
        orig 3000
MAXIMUM STJ EXIT
INIT    ENT3 0,1
        JMP CHANGEM
LOOP    CMPA X,3
        JGE  *+3
CHANGEM ENT2 0,3
        LDA  X,3
        DEC3 1
        J3P  LOOP
EXIT    JMP *
START   IOC 0(18)
        ENT1 7     prepare input, n = 7
        JMP MAXIMUM
        CHAR
        STX RESULT
        OUT PROMPT(18)
        HLT
PROMPT  ALF MAX V
        ALF ALUE=
RESULT  CON 0
        END START